"use strict";
const axios = require("axios");
const { OpenAI } = require("openai");
const pdfParse = require("pdf-parse");
const {
  getS3Client,
  getDynamoDBClient,
  getWebSocketClient,
} = require("../../utils/aws-config");
require("dotenv").config();

// Send WebSocket message about paper processing status
const sendStatusUpdate = async (userId, paperId, status, message) => {
  try {
    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Get user's active connections
    const connectionsResult = await documentClient
      .query({
        TableName: process.env.CONNECTIONS_TABLE,
        IndexName: "UserIdIndex",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
      .promise();

    if (!connectionsResult.Items || connectionsResult.Items.length === 0) {
      console.log(`[PROCESS-PAPER] No active connections for user ${userId}`);
      return true;
    }

    // Get WebSocket client
    const websocketAPI = getWebSocketClient();

    // Send message to all connections
    for (const connection of connectionsResult.Items) {
      try {
        await websocketAPI
          .postToConnection({
            ConnectionId: connection.connectionId,
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
          // Stale connection, remove it
          await documentClient
            .delete({
              TableName: process.env.CONNECTIONS_TABLE,
              Key: { connectionId: connection.connectionId },
            })
            .promise();
        } else {
          console.error("WebSocket error:", wsError);
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

// Extract text from PDF buffer
const extractTextFromPDF = async (pdfBuffer) => {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error("[PROCESS-PAPER] Error parsing PDF:", error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};

// Generate structured summary with OpenAI
const generateStructuredSummary = async (text, paperId, userId) => {
  try {
    await sendStatusUpdate(
      userId,
      paperId,
      "analyzing",
      "Analyzing paper content..."
    );

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Divide text into chunks if too long
    const chunks = chunkText(text, 12000);

    await sendStatusUpdate(
      userId,
      paperId,
      "summarizing",
      `Processing ${chunks.length} text chunks...`
    );

    let paperData = {};

    // Extract basic info from first chunk
    await sendStatusUpdate(
      userId,
      paperId,
      "summarizing",
      "Extracting basic paper information..."
    );

    const initialResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert at analyzing academic papers. Extract the main metadata and summary from the provided text.",
        },
        {
          role: "user",
          content: `This is the beginning of an academic paper. Extract the title, authors, abstract, and any visible keywords: ${chunks[0]}`,
        },
      ],
      functions: [
        {
          name: "extract_paper_metadata",
          description: "Extract metadata and abstract from academic paper",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The title of the paper",
              },
              authors: {
                type: "array",
                items: { type: "string" },
                description: "List of authors of the paper",
              },
              abstract: {
                type: "string",
                description: "A concise summary of the paper",
              },
              keywords: {
                type: "array",
                items: { type: "string" },
                description: "Keywords mentioned in the paper",
              },
            },
            required: ["title", "authors", "abstract"],
          },
        },
      ],
      temperature: 0.2,
    });

    paperData = JSON.parse(initialResponse.choices[0].message.content);

    // Extract key points from all chunks
    let keyPoints = [];
    for (let i = 0; i < chunks.length; i++) {
      await sendStatusUpdate(
        userId,
        paperId,
        "summarizing",
        `Extracting key points from section ${i + 1} of ${chunks.length}...`
      );

      const keyPointsResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an expert at extracting key points from academic papers. Extract important points with page references when possible.",
          },
          {
            role: "user",
            content: `This is part ${
              i + 1
            } of an academic paper. Extract key points from this section with page references when available: ${
              chunks[i]
            }`,
          },
        ],
        functions: [
          {
            name: "extract_key_points",
            description: "Extract key points from academic paper section",
            parameters: {
              type: "object",
              properties: {
                keyPoints: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      page: { type: "number" },
                    },
                    required: ["text"],
                  },
                  description:
                    "Key points from the paper, with page references when available",
                },
              },
              required: ["keyPoints"],
            },
          },
        ],
        temperature: 0.2,
      });

      const sectionPoints = JSON.parse(
        keyPointsResponse.choices[0].message.content
      ).keyPoints;
      keyPoints = [...keyPoints, ...sectionPoints];
    }

    // Generate final summary and citation info
    await sendStatusUpdate(
      userId,
      paperId,
      "summarizing",
      "Generating final summary and citations..."
    );

    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert at summarizing academic papers. Create a comprehensive summary based on the provided information.",
        },
        {
          role: "user",
          content: `Create a comprehensive summary for this paper. Title: "${
            paperData.title
          }", Authors: ${paperData.authors.join(", ")}, Abstract: "${
            paperData.abstract
          }"`,
        },
      ],
      functions: [
        {
          name: "generate_complete_summary",
          description: "Generate a comprehensive summary of the academic paper",
          parameters: {
            type: "object",
            properties: {
              methodology: {
                type: "string",
                description: "Description of research methodology used",
              },
              findings: {
                type: "string",
                description: "Main findings of the research",
              },
              conclusions: {
                type: "string",
                description: "Conclusions drawn in the paper",
              },
              citations: {
                type: "object",
                properties: {
                  mla: { type: "string" },
                  apa: { type: "string" },
                },
                required: ["mla", "apa"],
                description: "Citations in MLA and APA formats",
              },
            },
            required: ["methodology", "findings", "conclusions", "citations"],
          },
        },
      ],
      temperature: 0.3,
    });

    const finalSummary = JSON.parse(finalResponse.choices[0].message.content);

    // Combine all data
    const completeSummary = {
      ...paperData,
      keyPoints,
      methodology: finalSummary.methodology,
      findings: finalSummary.findings,
      conclusions: finalSummary.conclusions,
      citations: finalSummary.citations,
    };

    return completeSummary;
  } catch (error) {
    console.error(
      "[PROCESS-PAPER] Error generating structured summary:",
      error
    );
    throw new Error(`Failed to generate structured summary: ${error.message}`);
  }
};

// Utility function to split text into chunks
const chunkText = (text, maxLength) => {
  const chunks = [];
  let currentChunk = "";

  // Split by paragraphs
  const paragraphs = text.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    // If paragraph itself is longer than maxLength, force split
    if (paragraph.length > maxLength) {
      // Add current chunk if it exists
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      // Split long paragraph by sentences
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let sentenceChunk = "";

      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length + 1 <= maxLength) {
          sentenceChunk += (sentenceChunk ? " " : "") + sentence;
        } else {
          chunks.push(sentenceChunk);
          sentenceChunk = sentence;
        }
      }

      if (sentenceChunk) {
        currentChunk = sentenceChunk;
      }
    }
    // Check if adding paragraph to current chunk exceeds max length
    else if (currentChunk.length + paragraph.length + 2 > maxLength) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }
  }

  // Add final chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
};

// Convert summary JSON to markdown
const convertToMarkdown = (summary) => {
  let markdown = `# Summary of "${summary.title}"\n\n`;

  markdown += `## Authors\n`;
  summary.authors.forEach((author) => {
    markdown += `- ${author}\n`;
  });

  markdown += `\n## Abstract\n${summary.abstract}\n\n`;

  if (summary.keywords && summary.keywords.length > 0) {
    markdown += `## Keywords\n`;
    summary.keywords.forEach((keyword) => {
      markdown += `- ${keyword}\n`;
    });
    markdown += `\n`;
  }

  markdown += `## Key Points\n`;
  summary.keyPoints.forEach((point) => {
    markdown += `- ${point.text}`;
    if (point.page) {
      markdown += ` (p.${point.page})`;
    }
    markdown += `\n`;
  });

  markdown += `\n## Methodology\n${summary.methodology}\n\n`;

  markdown += `## Findings\n${summary.findings}\n\n`;

  markdown += `## Conclusions\n${summary.conclusions}\n\n`;

  markdown += `## Citations\n\n`;
  markdown += `### MLA Format\n${summary.citations.mla}\n\n`;
  markdown += `### APA Format\n${summary.citations.apa}\n`;

  return markdown;
};

// Save markdown file to S3
const saveMarkdownToS3 = async (paperId, userId, markdownContent) => {
  try {
    const s3 = getS3Client();
    const markdownKey = `summaries/${userId}/${paperId}/summary.md`;

    await s3
      .putObject({
        Bucket: process.env.PAPERS_BUCKET,
        Key: markdownKey,
        Body: markdownContent,
        ContentType: "text/markdown",
      })
      .promise();

    return markdownKey;
  } catch (error) {
    console.error("[PROCESS-PAPER] Error saving markdown to S3:", error);
    throw new Error(`Failed to save markdown to S3: ${error.message}`);
  }
};

// Save JSON data to S3
const saveJsonToS3 = async (paperId, userId, jsonData) => {
  try {
    const s3 = getS3Client();
    const jsonKey = `summaries/${userId}/${paperId}/summary.json`;

    await s3
      .putObject({
        Bucket: process.env.PAPERS_BUCKET,
        Key: jsonKey,
        Body: JSON.stringify(jsonData, null, 2),
        ContentType: "application/json",
      })
      .promise();

    return jsonKey;
  } catch (error) {
    console.error("[PROCESS-PAPER] Error saving JSON to S3:", error);
    throw new Error(`Failed to save JSON to S3: ${error.message}`);
  }
};

// Main processing function
module.exports.handler = async (event) => {
  try {
    console.log("[PROCESS-PAPER] Starting paper processing");

    // Extract information from event
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { paperId, fileKey, userId } = body;

    // Get clients
    const s3 = getS3Client();
    const documentClient = getDynamoDBClient();

    // Update status
    await sendStatusUpdate(
      userId,
      paperId,
      "started",
      "Starting paper processing"
    );

    // Download PDF file from S3
    await sendStatusUpdate(
      userId,
      paperId,
      "downloading",
      "Downloading PDF file"
    );

    let pdfBuffer;
    try {
      const s3Response = await s3
        .getObject({
          Bucket: process.env.PAPERS_BUCKET,
          Key: fileKey,
        })
        .promise();

      pdfBuffer = s3Response.Body;
      console.log("[PROCESS-PAPER] PDF file downloaded successfully");
    } catch (error) {
      console.error("[PROCESS-PAPER] Error downloading PDF file:", error);
      await sendStatusUpdate(
        userId,
        paperId,
        "failed",
        "Failed to download PDF file"
      );

      // Update failure status
      await documentClient
        .update({
          TableName: process.env.PAPERS_TABLE,
          Key: { paperId },
          UpdateExpression: "SET status = :status, lastUpdated = :timestamp",
          ExpressionAttributeValues: {
            ":status": "failed",
            ":timestamp": new Date().toISOString(),
          },
        })
        .promise();

      throw new Error(`Failed to download PDF file: ${error.message}`);
    }

    // Extract text from PDF
    await sendStatusUpdate(
      userId,
      paperId,
      "extracting",
      "Extracting text from PDF"
    );
    let extractedText;
    try {
      extractedText = await extractTextFromPDF(pdfBuffer);
      console.log(
        "[PROCESS-PAPER] Text extracted successfully, length:",
        extractedText.length
      );
    } catch (error) {
      console.error("[PROCESS-PAPER] Error extracting text from PDF:", error);
      await sendStatusUpdate(
        userId,
        paperId,
        "failed",
        "Failed to extract text from PDF"
      );

      // Update failure status
      await documentClient
        .update({
          TableName: process.env.PAPERS_TABLE,
          Key: { paperId },
          UpdateExpression: "SET status = :status, lastUpdated = :timestamp",
          ExpressionAttributeValues: {
            ":status": "failed",
            ":timestamp": new Date().toISOString(),
          },
        })
        .promise();

      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }

    // Generate summary with OpenAI
    await sendStatusUpdate(
      userId,
      paperId,
      "summarizing",
      "Generating summary with AI"
    );
    let summaryJson;
    try {
      summaryJson = await generateStructuredSummary(
        extractedText,
        paperId,
        userId
      );
      console.log("[PROCESS-PAPER] Summary generated successfully");
    } catch (error) {
      console.error("[PROCESS-PAPER] Error generating summary:", error);
      await sendStatusUpdate(
        userId,
        paperId,
        "failed",
        "Failed to generate summary"
      );

      // Update failure status
      await documentClient
        .update({
          TableName: process.env.PAPERS_TABLE,
          Key: { paperId },
          UpdateExpression:
            "SET status = :status, lastUpdated = :timestamp, errorMessage = :errorMessage",
          ExpressionAttributeValues: {
            ":status": "failed",
            ":timestamp": new Date().toISOString(),
            ":errorMessage": error.message,
          },
        })
        .promise();

      throw new Error(`Failed to generate summary: ${error.message}`);
    }

    // Convert JSON to markdown
    const summaryMarkdown = convertToMarkdown(summaryJson);

    // Save to S3
    await sendStatusUpdate(
      userId,
      paperId,
      "saving",
      "Saving summary to storage"
    );
    let jsonKey, markdownKey;
    try {
      jsonKey = await saveJsonToS3(paperId, userId, summaryJson);
      markdownKey = await saveMarkdownToS3(paperId, userId, summaryMarkdown);
      console.log("[PROCESS-PAPER] Summary files saved successfully");
    } catch (error) {
      console.error("[PROCESS-PAPER] Error saving summary files:", error);
      await sendStatusUpdate(
        userId,
        paperId,
        "failed",
        "Failed to save summary"
      );

      // Update failure status
      await documentClient
        .update({
          TableName: process.env.PAPERS_TABLE,
          Key: { paperId },
          UpdateExpression:
            "SET status = :status, lastUpdated = :timestamp, errorMessage = :errorMessage",
          ExpressionAttributeValues: {
            ":status": "failed",
            ":timestamp": new Date().toISOString(),
            ":errorMessage": error.message,
          },
        })
        .promise();

      throw new Error(`Failed to save summary: ${error.message}`);
    }

    // Update DynamoDB
    try {
      await documentClient
        .update({
          TableName: process.env.PAPERS_TABLE,
          Key: { paperId },
          UpdateExpression:
            "SET status = :status, summaryKey = :summaryKey, jsonKey = :jsonKey, lastUpdated = :timestamp, title = :title",
          ExpressionAttributeValues: {
            ":status": "completed",
            ":summaryKey": markdownKey,
            ":jsonKey": jsonKey,
            ":timestamp": new Date().toISOString(),
            ":title": summaryJson.title || "Untitled Paper",
          },
        })
        .promise();
      console.log("[PROCESS-PAPER] DynamoDB record updated successfully");
    } catch (error) {
      console.error("[PROCESS-PAPER] Error updating DynamoDB record:", error);
      // Files are already saved to S3, so not marking as complete failure
      await sendStatusUpdate(
        userId,
        paperId,
        "partial",
        "Summary generated but database update failed"
      );
      throw new Error(`Failed to update database record: ${error.message}`);
    }

    // Send completion status
    await sendStatusUpdate(
      userId,
      paperId,
      "completed",
      "Summary generated successfully"
    );

    console.log("[PROCESS-PAPER] Paper processing completed successfully");

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Paper processing completed successfully",
        paperId,
        summaryKey: markdownKey,
        jsonKey,
        title: summaryJson.title,
      }),
    };
  } catch (error) {
    console.error("[PROCESS-PAPER] Unhandled error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Error processing paper",
        error: error.message,
      }),
    };
  }
};
