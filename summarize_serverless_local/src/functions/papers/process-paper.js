"use strict";
const { getS3Client, getDynamoDBClient } = require("../../utils/aws-config");
const OpenAI = require("openai");
const pdfParse = require("pdf-parse");
require("dotenv").config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    "Content-Type": "application/json",
  },
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
    if (currentChunk.length + sentence.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ". " : "") + sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

// Enhanced extractTextFromPDF with better error handling
const extractTextFromPDF = async (pdfBuffer) => {
  try {
    console.log(`[PROCESS-PAPER] Starting PDF text extraction...`);

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Invalid PDF buffer - empty or null");
    }

    const pdfHeader = pdfBuffer.slice(0, 4).toString();
    if (pdfHeader !== "%PDF") {
      throw new Error("Invalid PDF file - incorrect file format");
    }

    const data = await pdfParse(pdfBuffer, {
      pagerender: (pageData) => {
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

    const cleanedText = extractedText
      .replace(/\n\s*\n/g, "\n\n")
      .replace(/\s+([.,!?;:])/g, "$1")
      .replace(/([^.!?])\n([A-Z])/g, "$1. $2");

    console.log(
      `[PROCESS-PAPER] Text extraction completed. Length: ${cleanedText.length} characters`
    );

    return cleanedText;
  } catch (error) {
    console.error(`[PROCESS-PAPER] Error extracting text from PDF:`, error);

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
const generateMarkdownFromStructured = (paperAnalysis, targetLanguage) => {
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

  const titles = sectionTitles[targetLanguage] || sectionTitles["English"];

  let markdown = `# ${titles.summary} "${paperAnalysis.title}"\n\n`;

  if (paperAnalysis.authors && paperAnalysis.authors.length > 0) {
    markdown += `## ${titles.authors}\n${paperAnalysis.authors.join(", ")}\n\n`;
  }

  if (paperAnalysis.publicationYear) {
    markdown += `## ${titles.publicationYear}\n${paperAnalysis.publicationYear}\n\n`;
  }

  const addSection = (title, points) => {
    if (points && points.length > 0) {
      markdown += `## ${title}\n`;
      points.forEach((point) => {
        markdown += `- ${point.point} (p.${point.page})\n`;
      });
      markdown += "\n";
    }
  };

  addSection(titles.abstract, paperAnalysis.abstract);
  addSection(titles.introduction, paperAnalysis.introduction);
  addSection(titles.methodology, paperAnalysis.methodology);
  addSection(titles.results, paperAnalysis.results);
  addSection(titles.discussion, paperAnalysis.discussion);
  addSection(titles.conclusions, paperAnalysis.conclusions);

  if (paperAnalysis.keyTerms && paperAnalysis.keyTerms.length > 0) {
    markdown += `## ${titles.keyTerms}\n`;
    paperAnalysis.keyTerms.forEach((item) => {
      markdown += `- **${item.term}**: ${item.definition}\n`;
    });
    markdown += "\n";
  }

  if (paperAnalysis.citation) {
    markdown += `## ${titles.citations}\n\n`;

    if (paperAnalysis.citation.mla) {
      markdown += `### ${titles.mlaFormat}\n${paperAnalysis.citation.mla}\n\n`;
    }

    if (paperAnalysis.citation.apa) {
      markdown += `### ${titles.apaFormat}\n${paperAnalysis.citation.apa}\n\n`;
    }
  }

  return markdown;
};

const processWithOpenAIMultilingual = async (text, paperId, targetLanguage) => {
  return retryWithBackoff(
    async () => {
      try {
        console.log(
          `[PROCESS-PAPER] Processing text with OpenAI in language: ${targetLanguage}...`
        );
        console.log(`[PROCESS-PAPER] Text length: ${text.length} characters`);

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
          response_format: { type: "json_object" },
        });

        if (!response.choices || !response.choices[0]) {
          throw new Error("Invalid response from OpenAI");
        }

        const paperAnalysis = JSON.parse(response.choices[0].message.content);

        const markdownContent = generateMarkdownFromStructured(
          paperAnalysis,
          targetLanguage
        );

        const keyPoints = [
          ...(paperAnalysis.abstract || []),
          ...(paperAnalysis.introduction || []),
          ...(paperAnalysis.methodology || []),
          ...(paperAnalysis.results || []),
          ...(paperAnalysis.discussion || []),
          ...(paperAnalysis.conclusions || []),
        ];

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
  );
};

// Process a paper - extract text, analyze, summarize, etc.
const processPaper = async (paperId, fileKey, userId) => {
  try {
    console.log(
      `[PROCESS-PAPER] Processing paper: ${paperId}, fileKey: ${fileKey}, userId: ${userId}`
    );

    const documentClient = getDynamoDBClient();
    const s3 = getS3Client();

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

    console.log(`[PROCESS-PAPER] Status updated to processing`);

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
    console.log(`[PROCESS-PAPER] Extracting text from PDF...`);
    const extractedText = await extractTextFromPDF(fileData.Body);

    // Process with OpenAI using the user's language preference
    console.log(`[PROCESS-PAPER] Analyzing content with AI...`);

    // Determine target language based on language code
    let targetLanguage = "English";
    switch (userLanguagePreference) {
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
        targetLanguage = "English";
    }

    const { analysis, markdownContent } = await processWithOpenAIMultilingual(
      extractedText,
      paperId,
      targetLanguage
    );

    console.log(`[PROCESS-PAPER] Generating summary...`);

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
              lang = :lang
        `,
        ExpressionAttributeValues: {
          ":status": "completed",
          ":summaryKey": summaryKey,
          ":timestamp": new Date().toISOString(),
          ":title": analysis.title || "Untitled Paper",
          ":lang": userLanguagePreference,
        },
        ExpressionAttributeNames: {
          "#status": "status",
        },
      })
      .promise();

    console.log(`[PROCESS-PAPER] Processing completed successfully`);

    return {
      success: true,
      paperId,
      status: "completed",
    };
  } catch (error) {
    console.error(`[PROCESS-PAPER] Error processing paper:`, error);

    try {
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

      console.log(`[PROCESS-PAPER] Paper marked as failed`);
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

    let paperId, fileKey, userId;

    // Handle both direct invocation and S3 trigger formats
    if (event.body) {
      const body =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;

      paperId = body.paperId;
      fileKey = body.fileKey;
      userId = body.userId;
    } else if (event.Records && event.Records[0].s3) {
      const s3Record = event.Records[0].s3;
      fileKey = s3Record.object.key;

      const keyParts = fileKey.split("/");
      if (keyParts.length >= 3) {
        userId = keyParts[1];
        paperId = keyParts[2];
      }
    } else if (event.paperId && event.fileKey && event.userId) {
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
