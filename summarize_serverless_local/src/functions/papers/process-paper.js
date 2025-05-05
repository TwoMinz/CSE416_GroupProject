"use strict";
const {
  getS3Client,
  getDynamoDBClient,
  getWebSocketClient,
} = require("../../utils/aws-config");
const OpenAI = require("openai");
const pdfParse = require("pdf-parse");
require("dotenv").config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function for retry with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, initialDelay = 1000) => {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      retries++;

      if (retries === maxRetries) {
        throw error;
      }

      const delay = initialDelay * Math.pow(2, retries - 1);
      console.log(`Retry ${retries}/${maxRetries} after ${delay}ms delay...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Helper function to chunk long text
const chunkText = (text, maxChunkSize = 10000) => {
  const chunks = [];
  const sentences = text.split(/[.!?]+\s+/);

  let currentChunk = "";

  for (const sentence of sentences) {
    // If adding this sentence would exceed the limit, save current chunk
    if (currentChunk.length + sentence.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ". " : "") + sentence;
    }
  }

  // Add the last chunk
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

// Helper function to merge analyses from different chunks
const mergeChunkAnalyses = (chunkedAnalyses) => {
  const merged = {
    title: "",
    authors: [],
    publicationYear: null,
    keyPoints: [],
    summary: "",
    methodology: "",
    conclusions: "",
    references: [],
    technicalTerms: [],
  };

  for (const analysis of chunkedAnalyses) {
    // Use title from the first chunk that has it
    if (!merged.title && analysis.title) {
      merged.title = analysis.title;
    }

    // Merge authors (unique)
    if (analysis.authors) {
      merged.authors = [...new Set([...merged.authors, ...analysis.authors])];
    }

    // Use publication year from the first chunk that has it
    if (!merged.publicationYear && analysis.publicationYear) {
      merged.publicationYear = analysis.publicationYear;
    }

    // Merge key points
    if (analysis.keyPoints) {
      merged.keyPoints = [...merged.keyPoints, ...analysis.keyPoints];
    }

    // Concatenate summaries with paragraph separator
    if (analysis.summary) {
      merged.summary += (merged.summary ? "\n\n" : "") + analysis.summary;
    }

    // Concatenate methodology
    if (analysis.methodology) {
      merged.methodology +=
        (merged.methodology ? " " : "") + analysis.methodology;
    }

    // Concatenate conclusions
    if (analysis.conclusions) {
      merged.conclusions +=
        (merged.conclusions ? " " : "") + analysis.conclusions;
    }

    // Merge references (unique)
    if (analysis.references) {
      merged.references = [
        ...new Set([...merged.references, ...analysis.references]),
      ];
    }

    // Merge technical terms (unique)
    if (analysis.technicalTerms) {
      merged.technicalTerms = [
        ...new Set([...merged.technicalTerms, ...analysis.technicalTerms]),
      ];
    }
  }

  return merged;
};

// Send WebSocket message about paper processing status
const sendStatusUpdate = async (userId, paperId, status, message) => {
  try {
    const documentClient = getDynamoDBClient();

    const connectionsResult = await documentClient
      .scan({
        TableName: process.env.CONNECTIONS_TABLE,
        FilterExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": String(userId),
        },
      })
      .promise();

    if (!connectionsResult.Items || connectionsResult.Items.length === 0) {
      console.log(`[PROCESS-PAPER] No active connections for user ${userId}`);
      return true;
    }

    const websocketAPI = getWebSocketClient();

    for (const connection of connectionsResult.Items) {
      try {
        const connectionId = connection.connectionId;

        if (!connectionId) {
          console.warn(
            `[PROCESS-PAPER] Connection without connectionId found: ${JSON.stringify(
              connection
            )}`
          );
          continue;
        }

        console.log(
          `[PROCESS-PAPER] Sending status update to connection: ${connectionId}`
        );

        await websocketAPI
          .postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify({
              type: "PAPER_STATUS_UPDATE",
              paperId,
              status,
              message,
            }),
          })
          .promise();
      } catch (wsError) {
        if (wsError.statusCode === 410) {
          console.log(
            `[PROCESS-PAPER] Removing stale connection: ${
              connection.id || connection.connectionId
            }`
          );

          try {
            await documentClient
              .delete({
                TableName: process.env.CONNECTIONS_TABLE,
                Key: { id: parseInt(connection.id) },
              })
              .promise();
          } catch (deleteError) {
            console.error(
              `[PROCESS-PAPER] Error deleting stale connection:`,
              deleteError
            );
          }
        } else {
          console.error("[PROCESS-PAPER] WebSocket error:", wsError);
        }
      }
    }

    return true;
  } catch (error) {
    console.error(
      `[PROCESS-PAPER] Error sending WebSocket status update:`,
      error
    );
    return false;
  }
};

// Enhanced extractTextFromPDF with better error handling
const extractTextFromPDF = async (pdfBuffer) => {
  try {
    console.log(`[PROCESS-PAPER] Starting PDF text extraction...`);

    // Check if the buffer is valid
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Invalid PDF buffer - empty or null");
    }

    // Check if the file is actually a PDF
    const pdfHeader = pdfBuffer.slice(0, 4).toString();
    if (pdfHeader !== "%PDF") {
      throw new Error("Invalid PDF file - incorrect file format");
    }

    const data = await pdfParse(pdfBuffer, {
      // Configure parsing options
      pagerender: (pageData) => {
        // Custom page rendering to handle difficult PDFs
        return pageData.getTextContent().then((textContent) => {
          const text = textContent.items.map((item) => item.str).join(" ");
          return text;
        });
      },
    });

    if (!data.text || data.text.trim().length === 0) {
      throw new Error(
        "No text content extracted from PDF - file might be scanned or corrupted"
      );
    }

    const extractedText = data.text;

    // Clean up the text
    const cleanedText = extractedText
      .replace(/\n\s*\n/g, "\n\n") // Replace multiple newlines with double newline
      .replace(/\s+([.,!?;:])/g, "$1") // Fix spacing around punctuation
      .replace(/([^.!?])\n([A-Z])/g, "$1. $2"); // Add period between sentences

    console.log(
      `[PROCESS-PAPER] Text extraction completed. Length: ${cleanedText.length} characters`
    );

    return cleanedText;
  } catch (error) {
    console.error(`[PROCESS-PAPER] Error extracting text from PDF:`, error);

    // Detailed error handling
    if (error.message.includes("Invalid PDF")) {
      throw new Error("The uploaded file is not a valid PDF or is corrupted");
    } else if (error.message.includes("No text content")) {
      throw new Error(
        "The PDF appears to be a scanned document. Please upload a text-based PDF"
      );
    } else {
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }
};

// Process very long texts by chunking
const processLongTextWithOpenAI = async (text, paperId) => {
  const MAX_CHUNK_SIZE = 10000; // Adjust based on OpenAI token limits

  // Chunk the text
  const chunks = chunkText(text, MAX_CHUNK_SIZE);
  console.log(`[PROCESS-PAPER] Split text into ${chunks.length} chunks`);

  // Process each chunk
  const chunkedAnalyses = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[PROCESS-PAPER] Processing chunk ${i + 1}/${chunks.length}`);

    // Adjust prompt for chunk processing
    const prompt = `
You are analyzing chunk ${i + 1} of ${chunks.length} of a research paper. 
Extract information in the same JSON format as before, but note that this is a partial analysis.

Text chunk:
${chunks[i]}

You are analyzing a research paper. Extract the following information and format it as a JSON object:

1. title: The paper's title (if available in this chunk)
2. authors: Array of author names (if available in this chunk)
3. publicationYear: Year of publication (if available in this chunk)
4. keyPoints: Array of key findings/concepts with page numbers (if available)
5. summary: A concise summary of this chunk
6. methodology: Brief description of methods used (if mentioned in this chunk)
7. conclusions: Main conclusions drawn (if mentioned in this chunk)
8. references: Brief list of significant references mentioned in this chunk
9. technicalTerms: Array of important technical terms used in this chunk

Respond ONLY with a JSON object in this format:
{
  "title": "Paper Title or null",
  "authors": ["Author 1", "Author 2"] or [],
  "publicationYear": 2023 or null,
  "keyPoints": [
    {"point": "Key finding", "page": 3},
    {"point": "Another insight", "page": 5}
  ] or [],
  "summary": "Summary of this chunk...",
  "methodology": "Brief method description or null",
  "conclusions": "Main conclusions or null",
  "references": ["Ref 1", "Ref 2"] or [],
  "technicalTerms": ["Term 1", "Term 2"] or []
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content:
            "You are analyzing a chunk of a research paper. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const chunkAnalysis = JSON.parse(response.choices[0].message.content);
    chunkedAnalyses.push(chunkAnalysis);
  }

  // Merge all chunk analyses
  const mergedAnalysis = mergeChunkAnalyses(chunkedAnalyses);

  return mergedAnalysis;
};

// Enhanced OpenAI processing with retry logic
const processWithOpenAI = async (text, paperId) => {
  return retryWithBackoff(
    async () => {
      try {
        console.log(`[PROCESS-PAPER] Processing text with OpenAI...`);
        console.log(`[PROCESS-PAPER] Text length: ${text.length} characters`);

        // Use chunking strategy for long texts
        if (text.length > 15000) {
          // Adjust threshold as needed
          return await processLongTextWithOpenAI(text, paperId);
        }

        // Original processing for shorter texts
        const prompt = `
You are analyzing a research paper. Extract the following information and format it as a JSON object:

1. title: The paper's title
2. authors: Array of author names
3. publicationYear: Year of publication
4. keyPoints: Array of key findings/concepts with page numbers (if available)
5. summary: A concise summary of the paper (2-3 paragraphs)
6. methodology: Brief description of methods used
7. conclusions: Main conclusions drawn
8. references: Brief list of significant references mentioned
9. technicalTerms: Array of important technical terms used

Text of the paper:
${text}

Respond ONLY with a JSON object in this format:
{
  "title": "Paper Title",
  "authors": ["Author 1", "Author 2"],
  "publicationYear": 2023,
  "keyPoints": [
    {"point": "Key finding", "page": 3},
    {"point": "Another insight", "page": 5}
  ],
  "summary": "Multi-paragraph summary...",
  "methodology": "Brief method description...",
  "conclusions": "Main conclusions...",
  "references": ["Ref 1", "Ref 2"],
  "technicalTerms": ["Term 1", "Term 2"]
}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content:
                "You are a research paper analysis assistant. Always respond with valid JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: "json_object" },
        });

        if (!response.choices || !response.choices[0]) {
          throw new Error("Invalid response from OpenAI");
        }

        const content = response.choices[0].message.content;

        // Validate JSON response
        try {
          const analysis = JSON.parse(content);

          // Validate required fields
          if (!analysis.title && !analysis.summary) {
            throw new Error("Analysis missing critical information");
          }

          console.log(`[PROCESS-PAPER] OpenAI analysis completed`);
          return analysis;
        } catch (parseError) {
          console.error("Failed to parse OpenAI response:", content);
          throw new Error("Invalid JSON response from OpenAI");
        }
      } catch (error) {
        console.error(`[PROCESS-PAPER] Error processing with OpenAI:`, error);

        // Handle specific OpenAI errors
        if (error.status === 429) {
          throw new Error("OpenAI rate limit reached. Please try again later.");
        } else if (error.status === 401) {
          throw new Error("Invalid OpenAI API key");
        } else if (error.status === 500) {
          throw new Error("OpenAI server error. Please try again later.");
        } else {
          throw new Error(`OpenAI API error: ${error.message}`);
        }
      }
    },
    3,
    2000
  ); // 3 retries with 2 second initial delay
};

// Generate markdown summary
const generateMarkdownSummary = (analysis) => {
  const markdown = `# ${analysis.title || "Untitled Paper"}

## Authors
${analysis.authors?.join(", ") || "Unknown"}

## Publication Year
${analysis.publicationYear || "Unknown"}

## Summary
${analysis.summary || "No summary available"}

## Methodology
${analysis.methodology || "No methodology information"}

## Key Points
${
  analysis.keyPoints
    ?.map(
      (point) => `- ${point.point}${point.page ? ` (p.${point.page})` : ""}`
    )
    .join("\n") || "No key points found"
}

## Conclusions
${analysis.conclusions || "No conclusions available"}

## Technical Terms
${analysis.technicalTerms?.join(", ") || "No technical terms found"}

## References
${
  analysis.references?.map((ref) => `- ${ref}`).join("\n") ||
  "No references found"
}

---
*Generated by SummarAIze*
`;

  return markdown;
};

// Generate citation information
const generateCitation = (analysis) => {
  const citation = {
    authors: analysis.authors || [],
    year: analysis.publicationYear || new Date().getFullYear(),
    title: analysis.title || "Untitled",
    publisher: "Publisher not specified",
  };

  // Generate APA format
  const authorString = citation.authors
    .map((author, index) => {
      if (
        index === citation.authors.length - 1 &&
        citation.authors.length > 1
      ) {
        return `& ${author}`;
      }
      return author;
    })
    .join(", ");

  citation.apa = `${authorString}. (${citation.year}). ${citation.title}. ${citation.publisher}.`;

  // Generate MLA format
  citation.mla = `${citation.authors[0]}${
    citation.authors.length > 1 ? " et al." : ""
  }. "${citation.title}." ${citation.publisher}, ${citation.year}.`;

  return citation;
};

// Process a paper - extract text, analyze, summarize, etc.
const processPaper = async (paperId, fileKey, userId) => {
  try {
    console.log(
      `[PROCESS-PAPER] Processing paper: ${paperId}, fileKey: ${fileKey}, userId: ${userId}`
    );

    const documentClient = getDynamoDBClient();
    const s3 = getS3Client();

    // Ensure paperId is the right type for our table
    const paperIdKey =
      typeof paperId === "string" && !isNaN(parseInt(paperId))
        ? parseInt(paperId)
        : paperId;

    // Update status to processing
    await documentClient
      .update({
        TableName: process.env.PAPERS_TABLE,
        Key: { id: paperIdKey },
        UpdateExpression: "SET #status = :status, lastUpdated = :timestamp",
        ExpressionAttributeValues: {
          ":status": "processing",
          ":timestamp": new Date().toISOString(),
        },
        ExpressionAttributeNames: {
          "#status": "status",
        },
      })
      .promise();

    // Send status update: Downloading
    await sendStatusUpdate(
      userId,
      paperId,
      "processing",
      "Downloading PDF from S3..."
    );

    // Download file from S3
    console.log(`[PROCESS-PAPER] Downloading file from S3: ${fileKey}`);
    const fileData = await s3
      .getObject({
        Bucket: process.env.PAPERS_BUCKET,
        Key: fileKey,
      })
      .promise();

    // Extract text from PDF
    await sendStatusUpdate(
      userId,
      paperId,
      "processing",
      "Extracting text from PDF..."
    );

    const extractedText = await extractTextFromPDF(fileData.Body);

    // Process with OpenAI
    await sendStatusUpdate(
      userId,
      paperId,
      "analyzing",
      "Analyzing content with AI..."
    );

    const analysis = await processWithOpenAI(extractedText, paperId);

    // Generate markdown summary
    await sendStatusUpdate(
      userId,
      paperId,
      "summarizing",
      "Generating summary..."
    );

    const markdownSummary = generateMarkdownSummary(analysis);

    // Generate citation information
    const citationInfo = generateCitation(analysis);

    // Upload summary to S3
    const summaryKey = `summaries/${userId}/${paperId}/summary.md`;
    await s3
      .putObject({
        Bucket: process.env.PAPERS_BUCKET,
        Key: summaryKey,
        Body: markdownSummary,
        ContentType: "text/markdown",
      })
      .promise();

    // Update paper record with all the information
    await documentClient
      .update({
        TableName: process.env.PAPERS_TABLE,
        Key: { id: paperIdKey },
        UpdateExpression: `
          SET #status = :status, 
              summary = :summary, 
              summaryKey = :summaryKey, 
              keyPoints = :keyPoints, 
              citation = :citation,
              lastUpdated = :timestamp,
              title = :title
        `,
        ExpressionAttributeValues: {
          ":status": "completed",
          ":summary": markdownSummary,
          ":summaryKey": summaryKey,
          ":keyPoints": analysis.keyPoints,
          ":citation": citationInfo,
          ":timestamp": new Date().toISOString(),
          ":title": analysis.title || "Untitled Paper",
        },
        ExpressionAttributeNames: {
          "#status": "status",
        },
      })
      .promise();

    // Send completion status
    await sendStatusUpdate(userId, paperId, "completed", "Summary ready!");

    return {
      success: true,
      paperId,
      status: "completed",
    };
  } catch (error) {
    console.error(`[PROCESS-PAPER] Error processing paper:`, error);

    try {
      // Update status to failed
      const documentClient = getDynamoDBClient();
      await documentClient
        .update({
          TableName: process.env.PAPERS_TABLE,
          Key: { id: paperId },
          UpdateExpression:
            "SET #status = :status, errorMessage = :error, lastUpdated = :timestamp",
          ExpressionAttributeValues: {
            ":status": "failed",
            ":error": error.message || "Unknown error",
            ":timestamp": new Date().toISOString(),
          },
          ExpressionAttributeNames: {
            "#status": "status",
          },
        })
        .promise();

      // Notify user of failure
      await sendStatusUpdate(
        userId,
        paperId,
        "failed",
        `Processing failed: ${error.message}`
      );
    } catch (updateError) {
      console.error(
        `[PROCESS-PAPER] Error updating failure status:`,
        updateError
      );
    }

    return {
      success: false,
      paperId,
      status: "failed",
      error: error.message,
    };
  }
};

module.exports.handler = async (event) => {
  try {
    console.log("[PROCESS-PAPER] Received event:", JSON.stringify(event));

    // Handle both direct invocation and S3 trigger formats
    let paperId, fileKey, userId;

    // Case 1: Direct Lambda invocation
    if (event.body) {
      const body =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;

      paperId = body.paperId;
      fileKey = body.fileKey;
      userId = body.userId;
    }
    // Case 2: S3 trigger
    else if (event.Records && event.Records[0].s3) {
      const s3Record = event.Records[0].s3;
      fileKey = s3Record.object.key;

      // Extract paperId and userId from the key path
      // Assuming format: uploads/{userId}/{paperId}/{filename}
      const keyParts = fileKey.split("/");
      if (keyParts.length >= 3) {
        userId = keyParts[1];
        paperId = keyParts[2];
      }
    }
    // Case 3: Direct payload with no body field
    else if (event.paperId && event.fileKey && event.userId) {
      paperId = event.paperId;
      fileKey = event.fileKey;
      userId = event.userId;
    }

    if (!paperId || !fileKey || !userId) {
      throw new Error(`Invalid event format. Missing required parameters. 
        paperId: ${paperId}, fileKey: ${fileKey}, userId: ${userId}`);
    }

    console.log(
      `[PROCESS-PAPER] Processing paper: ${paperId} for user: ${userId}`
    );

    const result = await processPaper(paperId, fileKey, userId);

    console.log(`[PROCESS-PAPER] Processing completed with result:`, result);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        result,
      }),
    };
  } catch (error) {
    console.error("[PROCESS-PAPER] Unhandled error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
