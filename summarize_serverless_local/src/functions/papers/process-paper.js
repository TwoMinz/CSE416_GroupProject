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

// Enhanced OpenAI processing with structured output format
const processWithOpenAI = async (text, paperId) => {
  return retryWithBackoff(
    async () => {
      try {
        console.log(`[PROCESS-PAPER] Processing text with OpenAI...`);
        console.log(`[PROCESS-PAPER] Text length: ${text.length} characters`);

        // Use chunking strategy for long texts
        if (text.length > 15000) {
          return await processLongTextWithOpenAI(text, paperId);
        }

        // Improved structured prompt with JSON schema described in the prompt
        const prompt = `
Analyze this research paper and extract structured information according to the following JSON format:

{
  "title": "The title of the research paper",
  "authors": ["Author 1", "Author 2", ...],
  "publicationYear": 2023,
  "abstract": [
    {"point": "Key point from abstract", "page": 1},
    {"point": "Another key point from abstract", "page": 1}
  ],
  "introduction": [
    {"point": "Key point from introduction", "page": 2},
    {"point": "Another key point from introduction", "page": 3}
  ],
  "methodology": [
    {"point": "Key methodological approach", "page": 4},
    {"point": "Another methodological point", "page": 5}
  ],
  "results": [
    {"point": "Important result", "page": 6},
    {"point": "Another important result", "page": 7}
  ],
  "discussion": [
    {"point": "Discussion point", "page": 8},
    {"point": "Another discussion point", "page": 9}
  ],
  "conclusions": [
    {"point": "Conclusion", "page": 10},
    {"point": "Another conclusion", "page": 10}
  ],
  "keyTerms": [
    {"term": "Technical term", "definition": "Definition of the term"},
    {"term": "Another term", "definition": "Its definition"}
  ],
  "citation": {
    "mla": "MLA format citation",
    "apa": "APA format citation"
  }
}

Paper text:
${text}

For each section (abstract, introduction, methodology, etc.), provide key points with their corresponding page numbers. If a section is not present in the paper, return an empty array for that section.

Make sure all page number references are accurate and all key points are factual statements from the paper.
Your response must be a valid JSON object that follows the format above precisely.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content:
                "You are a research paper analysis expert. Extract detailed, structured information from academic papers with accurate page references. Always respond with valid JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 3000,
          response_format: { type: "json_object" }, // Just specify json_object without schema
        });

        if (!response.choices || !response.choices[0]) {
          throw new Error("Invalid response from OpenAI");
        }

        // Parse the structured JSON response
        const paperAnalysis = JSON.parse(response.choices[0].message.content);

        // Generate markdown from structured data
        const markdownContent = generateMarkdownFromStructured(paperAnalysis);

        // Add all key points to a single array for database
        const keyPoints = [
          ...(paperAnalysis.abstract || []),
          ...(paperAnalysis.introduction || []),
          ...(paperAnalysis.methodology || []),
          ...(paperAnalysis.results || []),
          ...(paperAnalysis.discussion || []),
          ...(paperAnalysis.conclusions || []),
        ];

        // Create analysis object for the database
        const analysis = {
          title: paperAnalysis.title,
          keyPoints: keyPoints,
          citation: paperAnalysis.citation || {
            apa: "",
            mla: "",
            authors: paperAnalysis.authors || [],
            year: paperAnalysis.publicationYear || new Date().getFullYear(),
          },
        };

        console.log(`[PROCESS-PAPER] OpenAI structured analysis completed`);
        return {
          analysis,
          markdownContent,
          rawAnalysis: paperAnalysis,
        };
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

// Function to generate markdown from structured data
const generateMarkdownFromStructured = (paperAnalysis) => {
  let markdown = `# Summary of "${paperAnalysis.title}"\n\n`;

  // Add authors and publication year if available
  if (paperAnalysis.authors && paperAnalysis.authors.length > 0) {
    markdown += `## Authors\n${paperAnalysis.authors.join(", ")}\n\n`;
  }

  if (paperAnalysis.publicationYear) {
    markdown += `## Publication Year\n${paperAnalysis.publicationYear}\n\n`;
  }

  // Add sections with key points
  const addSection = (title, points) => {
    if (points && points.length > 0) {
      markdown += `## ${title}\n`;
      points.forEach((point) => {
        markdown += `- ${point.point} (p.${point.page})\n`;
      });
      markdown += "\n";
    }
  };

  addSection("Abstract", paperAnalysis.abstract);
  addSection("Introduction", paperAnalysis.introduction);
  addSection("Methodology", paperAnalysis.methodology);
  addSection("Results", paperAnalysis.results);
  addSection("Discussion", paperAnalysis.discussion);
  addSection("Conclusions", paperAnalysis.conclusions);

  // Add key terms
  if (paperAnalysis.keyTerms && paperAnalysis.keyTerms.length > 0) {
    markdown += `## Key Terms\n`;
    paperAnalysis.keyTerms.forEach((item) => {
      markdown += `- **${item.term}**: ${item.definition}\n`;
    });
    markdown += "\n";
  }

  // Add citations
  if (paperAnalysis.citation) {
    markdown += `## Citations\n\n`;

    if (paperAnalysis.citation.mla) {
      markdown += `### MLA Format\n${paperAnalysis.citation.mla}\n\n`;
    }

    if (paperAnalysis.citation.apa) {
      markdown += `### APA Format\n${paperAnalysis.citation.apa}\n\n`;
    }
  }

  return markdown;
};

// Structured output for long text processing with chunks
const processLongTextWithOpenAI = async (text, paperId) => {
  const MAX_CHUNK_SIZE = 10000;
  const chunks = chunkText(text, MAX_CHUNK_SIZE);
  console.log(`[PROCESS-PAPER] Split text into ${chunks.length} chunks`);

  // Process each chunk with structured output
  const chunkAnalyses = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[PROCESS-PAPER] Processing chunk ${i + 1}/${chunks.length}`);

    // Process chunk with structured output but without schema parameter
    const prompt = `
You are analyzing chunk ${i + 1} of ${chunks.length} of a research paper.
Extract structured information from this chunk according to the following JSON format:

{
  "title": "Title of the paper if found in this chunk",
  "authors": ["Author 1", "Author 2", ...],
  "publicationYear": 2023,
  "sectionKeyPoints": {
    "abstract": [
      {"point": "Key point from abstract", "page": 1},
      {"point": "Another key point from abstract", "page": 1}
    ],
    "introduction": [
      {"point": "Key point from introduction", "page": 2},
      {"point": "Another key point from introduction", "page": 3}
    ],
    "methodology": [
      {"point": "Key methodological approach", "page": 4},
      {"point": "Another methodological point", "page": 5}
    ],
    "results": [
      {"point": "Important result", "page": 6},
      {"point": "Another important result", "page": 7}
    ],
    "discussion": [
      {"point": "Discussion point", "page": 8},
      {"point": "Another discussion point", "page": 9}
    ],
    "conclusions": [
      {"point": "Conclusion", "page": 10},
      {"point": "Another conclusion", "page": 10}
    ]
  },
  "keyTerms": [
    {"term": "Technical term", "definition": "Definition of the term"},
    {"term": "Another term", "definition": "Its definition"}
  ],
  "citationInfo": {
    "journalName": "Journal name if found",
    "volume": "Volume info if found",
    "pages": "Page range if found",
    "doi": "DOI if found"
  }
}

Text chunk:
${chunks[i]}

Identify and extract:
1. Paper title, authors, and publication year if present
2. Key points from any sections (Abstract, Introduction, Methodology, Results, Discussion, Conclusion) with page numbers
3. Technical terms with definitions
4. Citation information

Only include information that is explicitly present in this chunk. For key points, always include the page number where they appear.
Your response must be a valid JSON object that follows the format above precisely.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a research paper analysis expert. Extract structured information from research paper sections. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }, // Just specify json_object without schema
    });

    const chunkAnalysis = JSON.parse(response.choices[0].message.content);
    chunkAnalyses.push(chunkAnalysis);
  }

  // Combine all chunks into a unified analysis
  const combinedAnalysis = mergeChunkAnalyses(chunkAnalyses);

  // Generate citation formats if we have enough information
  const citation = generateCitationFromInfo(combinedAnalysis);

  // Generate markdown from the combined analysis
  const markdownContent = generateMarkdownFromCombined(combinedAnalysis);

  // Flatten all key points for database storage
  const allKeyPoints = [];
  Object.keys(combinedAnalysis.sections).forEach((section) => {
    if (
      combinedAnalysis.sections[section] &&
      combinedAnalysis.sections[section].length > 0
    ) {
      combinedAnalysis.sections[section].forEach((point) => {
        allKeyPoints.push(point);
      });
    }
  });

  const analysis = {
    title: combinedAnalysis.title,
    keyPoints: allKeyPoints,
    citation: citation,
  };

  return {
    analysis,
    markdownContent,
    rawAnalysis: combinedAnalysis,
  };
};

// Helper function to merge chunk analyses
const mergeChunkAnalyses = (chunkAnalyses) => {
  // Initialize the combined analysis
  const combined = {
    title: "",
    authors: [],
    publicationYear: null,
    sections: {
      abstract: [],
      introduction: [],
      methodology: [],
      results: [],
      discussion: [],
      conclusions: [],
    },
    keyTerms: [],
    citationInfo: {
      journalName: "",
      volume: "",
      pages: "",
      doi: "",
    },
  };

  // Process each chunk analysis
  chunkAnalyses.forEach((chunk) => {
    // Set title from first chunk that has it
    if (!combined.title && chunk.title) {
      combined.title = chunk.title;
    }

    // Merge authors (avoiding duplicates)
    if (chunk.authors && chunk.authors.length > 0) {
      chunk.authors.forEach((author) => {
        if (!combined.authors.includes(author)) {
          combined.authors.push(author);
        }
      });
    }

    // Set publication year from first chunk that has it
    if (!combined.publicationYear && chunk.publicationYear) {
      combined.publicationYear = chunk.publicationYear;
    }

    // Merge section key points
    if (chunk.sectionKeyPoints) {
      Object.keys(chunk.sectionKeyPoints).forEach((section) => {
        if (
          chunk.sectionKeyPoints[section] &&
          chunk.sectionKeyPoints[section].length > 0
        ) {
          // Add points, avoiding duplicates
          chunk.sectionKeyPoints[section].forEach((point) => {
            // Check if this point already exists
            const exists = combined.sections[section].some(
              (existingPoint) =>
                existingPoint.point === point.point &&
                existingPoint.page === point.page
            );

            if (!exists) {
              combined.sections[section].push(point);
            }
          });
        }
      });
    }

    // Merge key terms (avoiding duplicates)
    if (chunk.keyTerms && chunk.keyTerms.length > 0) {
      chunk.keyTerms.forEach((term) => {
        const exists = combined.keyTerms.some(
          (existingTerm) => existingTerm.term === term.term
        );

        if (!exists) {
          combined.keyTerms.push(term);
        }
      });
    }

    // Merge citation info
    if (chunk.citationInfo) {
      if (
        !combined.citationInfo.journalName &&
        chunk.citationInfo.journalName
      ) {
        combined.citationInfo.journalName = chunk.citationInfo.journalName;
      }

      if (!combined.citationInfo.volume && chunk.citationInfo.volume) {
        combined.citationInfo.volume = chunk.citationInfo.volume;
      }

      if (!combined.citationInfo.pages && chunk.citationInfo.pages) {
        combined.citationInfo.pages = chunk.citationInfo.pages;
      }

      if (!combined.citationInfo.doi && chunk.citationInfo.doi) {
        combined.citationInfo.doi = chunk.citationInfo.doi;
      }
    }
  });

  return combined;
};

// Generate citation formats from combined information
const generateCitationFromInfo = (combinedAnalysis) => {
  const citation = {
    authors: combinedAnalysis.authors || [],
    year: combinedAnalysis.publicationYear || new Date().getFullYear(),
    title: combinedAnalysis.title || "Untitled Paper",
    journal: combinedAnalysis.citationInfo.journalName || "",
    volume: combinedAnalysis.citationInfo.volume || "",
    pages: combinedAnalysis.citationInfo.pages || "",
    doi: combinedAnalysis.citationInfo.doi || "",
  };

  // Generate APA format
  let authorString =
    citation.authors.length > 0
      ? citation.authors
          .map((author, index) => {
            const nameParts = author.split(" ");
            const lastName = nameParts.pop();
            const initials = nameParts.map((n) => `${n.charAt(0)}.`).join(" ");
            return `${lastName}, ${initials}`;
          })
          .join(", ")
      : "Unknown Author";

  if (citation.authors.length > 1) {
    const lastAuthor = authorString.split(", ").pop();
    authorString = authorString.replace(`, ${lastAuthor}`, ` & ${lastAuthor}`);
  }

  citation.apa = `${authorString} (${citation.year}). ${citation.title}`;
  if (citation.journal) {
    citation.apa += `. ${citation.journal}`;
    if (citation.volume) citation.apa += `, ${citation.volume}`;
    if (citation.pages) citation.apa += `, ${citation.pages}`;
  }
  if (citation.doi) citation.apa += `. https://doi.org/${citation.doi}`;

  // Generate MLA format
  authorString =
    citation.authors.length > 0
      ? citation.authors.join(", ")
      : "Unknown Author";

  if (citation.authors.length > 1) {
    authorString = citation.authors[0] + " et al.";
  }

  citation.mla = `${authorString}. "${citation.title}."`;
  if (citation.journal) {
    citation.mla += ` ${citation.journal}`;
    if (citation.volume) citation.mla += `, vol. ${citation.volume}`;
    if (citation.pages) citation.mla += `, ${citation.pages}`;
  }
  citation.mla += `, ${citation.year}`;
  if (citation.doi) citation.mla += `. DOI: ${citation.doi}`;

  return {
    apa: citation.apa,
    mla: citation.mla,
    authors: citation.authors,
    year: citation.year,
  };
};

// Generate markdown from combined analysis
const generateMarkdownFromCombined = (combinedAnalysis) => {
  let markdown = `# Summary of "${
    combinedAnalysis.title || "Untitled Paper"
  }"\n\n`;

  if (combinedAnalysis.authors && combinedAnalysis.authors.length > 0) {
    markdown += `## Authors\n${combinedAnalysis.authors.join(", ")}\n\n`;
  }

  if (combinedAnalysis.publicationYear) {
    markdown += `## Publication Year\n${combinedAnalysis.publicationYear}\n\n`;
  }

  // Add each section
  const sections = {
    Abstract: combinedAnalysis.sections.abstract,
    Introduction: combinedAnalysis.sections.introduction,
    Methodology: combinedAnalysis.sections.methodology,
    Results: combinedAnalysis.sections.results,
    Discussion: combinedAnalysis.sections.discussion,
    Conclusions: combinedAnalysis.sections.conclusions,
  };

  Object.entries(sections).forEach(([sectionName, points]) => {
    if (points && points.length > 0) {
      // Sort points by page number
      points.sort((a, b) => a.page - b.page);

      markdown += `## ${sectionName}\n`;
      points.forEach((point) => {
        markdown += `- ${point.point} (p.${point.page})\n`;
      });
      markdown += "\n";
    }
  });

  // Add key terms
  if (combinedAnalysis.keyTerms && combinedAnalysis.keyTerms.length > 0) {
    markdown += `## Key Terms\n`;
    combinedAnalysis.keyTerms.forEach((term) => {
      markdown += `- **${term.term}**: ${term.definition}\n`;
    });
    markdown += "\n";
  }

  // Generate and add citations
  const citation = generateCitationFromInfo(combinedAnalysis);

  markdown += `## Citations\n\n`;
  markdown += `### MLA Format\n${citation.mla}\n\n`;
  markdown += `### APA Format\n${citation.apa}\n\n`;

  return markdown;
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

    // Use the improved OpenAI processing function
    const { analysis, markdownContent } = await processWithOpenAI(
      extractedText,
      paperId
    );

    // Use the already formatted markdown content from OpenAI
    await sendStatusUpdate(
      userId,
      paperId,
      "summarizing",
      "Generating summary..."
    );

    // Upload summary to S3
    const summaryKey = `summaries/${userId}/${paperId}/summary.md`;
    await s3
      .putObject({
        Bucket: process.env.PAPERS_BUCKET,
        Key: summaryKey,
        Body: markdownContent,
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
              summaryKey = :summaryKey, 
              lastUpdated = :timestamp,
              title = :title
        `,
        ExpressionAttributeValues: {
          ":status": "completed",
          ":summaryKey": summaryKey,
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
