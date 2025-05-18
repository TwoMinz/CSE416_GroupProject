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
const generateCitationFromInfo = (combinedAnalysis, language) => {
  const citation = {
    authors: combinedAnalysis.authors || [],
    year: combinedAnalysis.publicationYear || new Date().getFullYear(),
    title: combinedAnalysis.title || "Untitled Paper",
    journal: combinedAnalysis.citationInfo?.journalName || "",
    volume: combinedAnalysis.citationInfo?.volume || "",
    pages: combinedAnalysis.citationInfo?.pages || "",
    doi: combinedAnalysis.citationInfo?.doi || "",
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

  // Adjust conjunction based on language
  let conjunction = "";
  if (language === "Korean") {
    conjunction = "및";
  } else if (language === "Spanish") {
    conjunction = "y";
  } else if (language === "French") {
    conjunction = "et";
  } else {
    conjunction = "&"; // Default English
  }

  if (citation.authors.length > 1) {
    const lastAuthor = authorString.split(", ").pop();
    authorString = authorString.replace(
      `, ${lastAuthor}`,
      ` ${conjunction} ${lastAuthor}`
    );
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
    // "et al." is used in all languages in academic context
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

    // Get the user's language preference
    let userLanguagePreference = 1; // Default to English
    try {
      console.log(
        `[PROCESS-PAPER] Looking up language preference for user ID: ${userId}`
      );
      const userResult = await documentClient
        .get({
          TableName: process.env.USERS_TABLE,
          Key: { id: parseInt(userId) },
        })
        .promise();

      if (userResult.Item && userResult.Item.transLang) {
        userLanguagePreference = userResult.Item.transLang;
        console.log(
          `[PROCESS-PAPER] User language preference found: ${userLanguagePreference}`
        );
      } else {
        console.log(
          `[PROCESS-PAPER] No language preference found for user, using default (English)`
        );
      }
    } catch (userError) {
      console.error(
        `[PROCESS-PAPER] Error getting user language preference:`,
        userError
      );
      // Continue with default language if error occurs
    }

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

    // Process with OpenAI using the user's language preference
    await sendStatusUpdate(
      userId,
      paperId,
      "analyzing",
      "Analyzing content with AI..."
    );

    // Use the multilingual OpenAI processing function
    const { analysis, markdownContent } = await processWithOpenAIMultilingual(
      extractedText,
      paperId,
      userLanguagePreference
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

    // Update paper record with all the information including the language used
    await documentClient
      .update({
        TableName: process.env.PAPERS_TABLE,
        Key: { id: paperIdKey },
        UpdateExpression: `
          SET #status = :status, 
              summaryKey = :summaryKey, 
              lastUpdated = :timestamp,
              title = :title,
              language = :language
        `,
        ExpressionAttributeValues: {
          ":status": "completed",
          ":summaryKey": summaryKey,
          ":timestamp": new Date().toISOString(),
          ":title": analysis.title || "Untitled Paper",
          ":language": userLanguagePreference,
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

const processWithOpenAIMultilingual = async (text, paperId, languageCode) => {
  return retryWithBackoff(
    async () => {
      try {
        console.log(
          `[PROCESS-PAPER] Processing text with OpenAI in language code: ${languageCode}...`
        );
        console.log(`[PROCESS-PAPER] Text length: ${text.length} characters`);

        // Determine target language based on language code
        let targetLanguage = "English";
        switch (languageCode) {
          case 2:
            targetLanguage = "Korean";
            break;
          case 3:
            targetLanguage = "Spanish";
            break;
          case 4:
            targetLanguage = "French";
            break;
          default:
            targetLanguage = "English"; // Default to English
        }

        // Use chunking strategy for long texts
        if (text.length > 15000) {
          return await processLongTextWithOpenAIMultilingual(
            text,
            paperId,
            targetLanguage
          );
        }

        // Improved structured prompt with language specification
        const prompt = `
Analyze this research paper and extract structured information according to the following JSON format.
Provide your response in ${targetLanguage} language.

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

For each section (abstract, introduction, methodology, etc.), provide key points with their corresponding page numbers in ${targetLanguage} language. If a section is not present in the paper, return an empty array for that section.

Make sure all page number references are accurate and all key points are factual statements from the paper.
Ensure all text is in ${targetLanguage} language.
Your response must be a valid JSON object that follows the format above precisely.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          messages: [
            {
              role: "system",
              content: `You are a research paper analysis expert who provides responses in ${targetLanguage} language. Extract detailed, structured information from academic papers with accurate page references. Always respond with valid JSON.`,
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
        const markdownContent = generateMarkdownFromStructured(
          paperAnalysis,
          targetLanguage
        );

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
          language: targetLanguage,
        };

        console.log(
          `[PROCESS-PAPER] OpenAI structured analysis completed in ${targetLanguage}`
        );
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

const processLongTextWithOpenAIMultilingual = async (
  text,
  paperId,
  targetLanguage
) => {
  const MAX_CHUNK_SIZE = 10000;
  const chunks = chunkText(text, MAX_CHUNK_SIZE);
  console.log(`[PROCESS-PAPER] Split text into ${chunks.length} chunks`);

  // Process each chunk with structured output
  const chunkAnalyses = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(
      `[PROCESS-PAPER] Processing chunk ${i + 1}/${
        chunks.length
      } in ${targetLanguage}`
    );

    // Process chunk with structured output but without schema parameter
    const prompt = `
You are analyzing chunk ${i + 1} of ${chunks.length} of a research paper.
Extract structured information from this chunk according to the following JSON format.
Provide your response in ${targetLanguage} language.

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
Ensure all text is in ${targetLanguage} language.
Your response must be a valid JSON object that follows the format above precisely.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a research paper analysis expert who provides responses in ${targetLanguage} language. Extract structured information from research paper sections. Always respond with valid JSON.`,
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
  const citation = generateCitationFromInfo(combinedAnalysis, targetLanguage);

  // Generate markdown from the combined analysis
  const markdownContent = generateMarkdownFromCombined(
    combinedAnalysis,
    targetLanguage
  );

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
    language: targetLanguage,
  };

  return {
    analysis,
    markdownContent,
    rawAnalysis: combinedAnalysis,
  };
};

// Similarly update generateMarkdownFromCombined to handle language
const generateMarkdownFromCombined = (combinedAnalysis, language) => {
  // Define section titles based on language
  const sectionTitles = {
    English: {
      summary: "Summary of",
      authors: "Authors",
      publicationYear: "Publication Year",
      abstract: "Abstract",
      introduction: "Introduction",
      methodology: "Methodology",
      results: "Results",
      discussion: "Discussion",
      conclusions: "Conclusions",
      keyTerms: "Key Terms",
      citations: "Citations",
      mlaFormat: "MLA Format",
      apaFormat: "APA Format",
    },
    Korean: {
      summary: "요약:",
      authors: "저자",
      publicationYear: "출판 연도",
      abstract: "초록",
      introduction: "서론",
      methodology: "방법론",
      results: "결과",
      discussion: "논의",
      conclusions: "결론",
      keyTerms: "핵심 용어",
      citations: "인용",
      mlaFormat: "MLA 형식",
      apaFormat: "APA 형식",
    },
    Spanish: {
      summary: "Resumen de",
      authors: "Autores",
      publicationYear: "Año de publicación",
      abstract: "Resumen",
      introduction: "Introducción",
      methodology: "Metodología",
      results: "Resultados",
      discussion: "Discusión",
      conclusions: "Conclusiones",
      keyTerms: "Términos clave",
      citations: "Citas",
      mlaFormat: "Formato MLA",
      apaFormat: "Formato APA",
    },
    French: {
      summary: "Résumé de",
      authors: "Auteurs",
      publicationYear: "Année de publication",
      abstract: "Résumé",
      introduction: "Introduction",
      methodology: "Méthodologie",
      results: "Résultats",
      discussion: "Discussion",
      conclusions: "Conclusions",
      keyTerms: "Termes clés",
      citations: "Citations",
      mlaFormat: "Format MLA",
      apaFormat: "Format APA",
    },
  };

  // Default to English if language not found
  const titles = sectionTitles[language] || sectionTitles["English"];

  let markdown = `# ${titles.summary} "${
    combinedAnalysis.title || "Untitled Paper"
  }"\n\n`;

  if (combinedAnalysis.authors && combinedAnalysis.authors.length > 0) {
    markdown += `## ${titles.authors}\n${combinedAnalysis.authors.join(
      ", "
    )}\n\n`;
  }

  if (combinedAnalysis.publicationYear) {
    markdown += `## ${titles.publicationYear}\n${combinedAnalysis.publicationYear}\n\n`;
  }

  // Add each section
  const sections = {
    [titles.abstract]: combinedAnalysis.sections.abstract,
    [titles.introduction]: combinedAnalysis.sections.introduction,
    [titles.methodology]: combinedAnalysis.sections.methodology,
    [titles.results]: combinedAnalysis.sections.results,
    [titles.discussion]: combinedAnalysis.sections.discussion,
    [titles.conclusions]: combinedAnalysis.sections.conclusions,
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
    markdown += `## ${titles.keyTerms}\n`;
    combinedAnalysis.keyTerms.forEach((term) => {
      markdown += `- **${term.term}**: ${term.definition}\n`;
    });
    markdown += "\n";
  }

  // Generate and add citations
  const citation = generateCitationFromInfo(combinedAnalysis, language);

  markdown += `## ${titles.citations}\n\n`;
  markdown += `### ${titles.mlaFormat}\n${citation.mla}\n\n`;
  markdown += `### ${titles.apaFormat}\n${citation.apa}\n\n`;

  return markdown;
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
