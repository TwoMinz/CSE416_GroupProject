"use strict";
const AWS = require("aws-sdk");
const axios = require("axios");
require("dotenv").config();

// Configure AWS
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || "localhost",
  endpoint:
    process.env.NODE_ENV === "development"
      ? "http://localhost:4569"
      : undefined,
  s3ForcePathStyle: process.env.NODE_ENV === "development",
  accessKeyId:
    process.env.NODE_ENV === "development" ? "LOCAL_ACCESS_KEY" : undefined,
  secretAccessKey:
    process.env.NODE_ENV === "development" ? "LOCAL_SECRET_KEY" : undefined,
});

const documentClient = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || "localhost",
  endpoint:
    process.env.NODE_ENV === "development"
      ? "http://localhost:8000"
      : undefined,
  accessKeyId:
    process.env.NODE_ENV === "development" ? "LOCAL_ACCESS_KEY" : undefined,
  secretAccessKey:
    process.env.NODE_ENV === "development" ? "LOCAL_SECRET_KEY" : undefined,
});

// WebSocket API for sending updates
const ApiGatewayManagementApi = AWS.ApiGatewayManagementApi;
let websocketAPI;

if (process.env.NODE_ENV !== "development") {
  websocketAPI = new ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint: process.env.WEBSOCKET_API_URL,
  });
}

// Helper function to extract citation info from paper text
const extractCitationInfo = (text) => {
  // In a real implementation, you would use NLP to extract author names, publication year, etc.
  // For this example, we'll provide a basic implementation

  const authors = [];
  let year = null;
  let title = null;
  let publisher = null;

  // Simple regex patterns for demonstration
  const authorPattern = /by\s+([A-Za-z\s.,]+?)(?:\.|and|\(|,|\d|$)/i;
  const yearPattern = /\b(19|20)\d{2}\b/;
  const titlePattern = /(?:"([^"]+)"|'([^']+)')/;
  const publisherPattern = /(?:published by|published in|in)\s+([A-Za-z\s&]+)/i;

  // Extract title (very basic approach)
  const titleMatch = text.match(titlePattern);
  if (titleMatch) {
    title = titleMatch[1] || titleMatch[2];
  }

  // Extract year
  const yearMatch = text.match(yearPattern);
  if (yearMatch) {
    year = parseInt(yearMatch[0]);
  }

  // Extract authors (very basic approach)
  const authorMatch = text.match(authorPattern);
  if (authorMatch && authorMatch[1]) {
    const authorText = authorMatch[1].trim();
    authorText.split(/(?:,|and|\&)/).forEach((author) => {
      const trimmedAuthor = author.trim();
      if (trimmedAuthor) {
        authors.push(trimmedAuthor);
      }
    });
  }

  // Extract publisher
  const publisherMatch = text.match(publisherPattern);
  if (publisherMatch && publisherMatch[1]) {
    publisher = publisherMatch[1].trim();
  }

  // Generate citations
  let apa = "";
  let mla = "";

  if (authors.length > 0) {
    // APA: Last, F. M., & Last, F. M. (Year). Title. Publisher.
    apa = authors
      .map((author) => {
        const parts = author.split(" ");
        if (parts.length > 1) {
          const lastName = parts[parts.length - 1];
          const initials = parts
            .slice(0, -1)
            .map((name) => `${name.charAt(0)}.`)
            .join(" ");
          return `${lastName}, ${initials}`;
        }
        return author;
      })
      .join(", ");

    if (authors.length > 1) {
      apa = apa.replace(/,([^,]*)$/, ", &$1");
    }

    if (year) {
      apa += ` (${year}).`;
    } else {
      apa += ".";
    }

    if (title) {
      apa += ` ${title}.`;
    }

    if (publisher) {
      apa += ` ${publisher}.`;
    }

    // MLA: Last, First M., and First M. Last. "Title." Publisher, Year.
    mla = authors
      .map((author) => {
        const parts = author.split(" ");
        if (parts.length > 1) {
          const lastName = parts[parts.length - 1];
          const firstName = parts.slice(0, -1).join(" ");
          return `${lastName}, ${firstName}`;
        }
        return author;
      })
      .join(", ");

    if (authors.length > 1) {
      mla = mla.replace(/,([^,]*)$/, ", and$1");
    }

    if (title) {
      mla += `. "${title}"`;
    }

    if (publisher) {
      mla += `. ${publisher}`;
    }

    if (year) {
      mla += `, ${year}`;
    }

    mla += ".";
  }

  return {
    authors: authors.length > 0 ? authors : ["Unknown Author"],
    year: year || new Date().getFullYear(),
    publisher: publisher || "Unknown Publisher",
    apa: apa || "Citation information could not be automatically generated.",
    mla: mla || "Citation information could not be automatically generated.",
  };
};

// Function to extract key points with page references
const extractKeyPoints = (text) => {
  // In a real implementation, you would use NLP techniques
  // For this example, we'll simulate it with some basic patterns

  const keyPoints = [];
  const paragraphs = text.split("\n\n");

  // Get a few "key" sentences and assign random page numbers
  const importantPhrases = [
    "important",
    "significant",
    "key",
    "primary",
    "essential",
    "crucial",
  ];

  paragraphs.forEach((paragraph) => {
    const sentences = paragraph
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);

    sentences.forEach((sentence) => {
      const lowerSentence = sentence.toLowerCase();

      // If the sentence contains important-sounding phrases, consider it a key point
      if (
        importantPhrases.some((phrase) => lowerSentence.includes(phrase)) ||
        Math.random() < 0.1
      ) {
        // Randomly select some sentences

        // Assign a random page number between 1 and 20
        const page = Math.floor(Math.random() * 20) + 1;

        keyPoints.push({
          text: sentence.trim(),
          page,
        });

        // Limit to 5 key points for this example
        if (keyPoints.length >= 5) {
          return;
        }
      }
    });

    if (keyPoints.length >= 5) {
      return;
    }
  });

  return keyPoints;
};

// Function to make OpenAI API request for summarization
const generateSummary = async (text) => {
  // If in development mode without OpenAI key, generate a mock summary
  if (process.env.NODE_ENV === "development" || !process.env.OPENAI_API_KEY) {
    console.log("Generating mock summary for development");

    const mockSummary = `# Paper Summary

## Abstract
This research paper discusses the key challenges in academic research and proposes a new approach to address them.

## Key Findings
- The authors identified three main barriers to efficient research: time constraints, technical complexity, and inefficient search systems.
- The proposed AI-based system demonstrated a 45% improvement in paper comprehension time.
- User studies showed high satisfaction rates among graduate students and researchers.

## Methodology
The study employed a mixed-methods approach, combining quantitative analysis of user performance with qualitative feedback from participants.

## Conclusions
The findings suggest that AI-powered summarization tools can significantly enhance research productivity while maintaining comprehension quality.`;

    return mockSummary;
  }

  try {
    // OpenAI API call for actual summary
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are an academic research assistant. Create a detailed summary of the paper with sections for Abstract, Key Findings, Methodology, and Conclusions. Identify the most important points and include page references when possible.",
          },
          {
            role: "user",
            content: `Please summarize the following academic paper:\n\n${text}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(
      "Error calling OpenAI API:",
      error.response?.data || error.message
    );
    throw new Error("Failed to generate summary using OpenAI");
  }
};

// Function to generate paper recommendations
const generateRecommendations = (paperTitle, paperSummary) => {
  // In a real implementation, you would use a recommendation engine or AI
  // For this example, we'll return mock recommendations

  const mockRecommendations = [
    {
      title:
        "Advances in Natural Language Processing for Research Paper Analysis",
      author: "Sarah Johnson et al.",
      createdAt: new Date().toISOString(),
    },
    {
      title: "Machine Learning Approaches to Academic Text Summarization",
      author: "David Chen and Maria Rodriguez",
      createdAt: new Date().toISOString(),
    },
    {
      title: "Improving Research Efficiency Through AI Tools",
      author: "Alex Patel",
      createdAt: new Date().toISOString(),
    },
  ];

  return mockRecommendations;
};

// Main handler function
module.exports.handler = async (event) => {
  try {
    // In production, this would be triggered by an S3 event
    // For development, we could manually invoke this function

    let bucket, key, paperId, userId;

    if (process.env.NODE_ENV === "development") {
      // For development testing, use hardcoded values or parse from event
      const body =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      bucket = process.env.PAPERS_BUCKET;
      key = body?.fileKey;
      paperId = body?.paperId;
      userId = body?.userId;

      if (!key || !paperId || !userId) {
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
          },
          body: JSON.stringify({
            success: false,
            message: "Missing required parameters: fileKey, paperId, or userId",
          }),
        };
      }
    } else {
      // For production with S3 trigger
      const s3Event = event.Records[0].s3;
      bucket = s3Event.bucket.name;
      key = decodeURIComponent(s3Event.object.key.replace(/\+/g, " "));

      // Extract paperId from the file key
      // Assuming key format: papers/{userId}/{paperId}/{filename}
      const keyParts = key.split("/");
      if (keyParts.length >= 3) {
        userId = keyParts[1];
        paperId = keyParts[2];
      } else {
        console.error("Invalid S3 key format:", key);
        return;
      }
    }

    // Update paper status to processing
    await documentClient
      .update({
        TableName: process.env.PAPERS_TABLE,
        Key: { paperId },
        UpdateExpression: "SET status = :status, lastUpdated = :timestamp",
        ExpressionAttributeValues: {
          ":status": "processing",
          ":timestamp": new Date().toISOString(),
        },
      })
      .promise();

    // Send WebSocket message (in development, this would just log)
    if (process.env.NODE_ENV === "development") {
      console.log(
        `WebSocket message would be sent: Paper ${paperId} - Status: processing`
      );
    } else {
      // In production, get connection IDs for the user and send updates
      // This is just a placeholder for the real implementation
    }

    // Download PDF from S3
    let pdfData;
    try {
      const pdfObject = await s3
        .getObject({
          Bucket: bucket,
          Key: key,
        })
        .promise();

      pdfData = pdfObject.Body;
    } catch (error) {
      console.error("Error downloading PDF from S3:", error);

      await documentClient
        .update({
          TableName: process.env.PAPERS_TABLE,
          Key: { paperId },
          UpdateExpression:
            "SET status = :status, processingError = :error, lastUpdated = :timestamp",
          ExpressionAttributeValues: {
            ":status": "failed",
            ":error": "Error downloading PDF: " + error.message,
            ":timestamp": new Date().toISOString(),
          },
        })
        .promise();

      throw new Error("Failed to download PDF from S3");
    }

    // For development, we'll skip actual PDF text extraction and use a mock text
    // In production, you would use a PDF extraction library or service
    const extractedText =
      process.env.NODE_ENV === "development"
        ? `SummarAIze: An AI-Powered Research Paper Assistant
      by Minhyeok Im and Semin Bae
      
      Abstract
      Reading research papers is important for academic learning, but it can be time-consuming and
      difficult, especially for students who struggle with their coursework. Long papers, complex
      terminology, and inefficient search systems make the process even harder. SummarAIze aims to solve
      this by using AI to summarize papers, recommend relevant research, and archive in their library. We
      want to make academic reading faster and easier.
      
      Introduction
      Academic research requires extensive reading of scholarly literature. However, students and
      researchers face significant challenges in efficiently processing these materials. This paper
      introduces SummarAIze, an AI-powered platform designed to address these challenges through
      automated summarization, recommendation, and management of research papers.
      
      The key contributions of this work include:
      1. A novel approach to academic paper summarization with page-specific references
      2. An integrated citation extraction and formatting system
      3. A personalized recommendation engine for related research
      
      Published in ACM Digital Library, 2025.`
        : "Extracted text from PDF would go here in production";

    // Generate summary using OpenAI API or mock for development
    let summary;
    try {
      summary = await generateSummary(extractedText);
    } catch (error) {
      console.error("Error generating summary:", error);

      await documentClient
        .update({
          TableName: process.env.PAPERS_TABLE,
          Key: { paperId },
          UpdateExpression:
            "SET status = :status, processingError = :error, lastUpdated = :timestamp",
          ExpressionAttributeValues: {
            ":status": "failed",
            ":error": "Error generating summary: " + error.message,
            ":timestamp": new Date().toISOString(),
          },
        })
        .promise();

      throw new Error("Failed to generate summary");
    }

    // Extract key points with page references
    const keyPoints = extractKeyPoints(extractedText);

    // Extract citation information
    const citation = extractCitationInfo(extractedText);

    // Get paper title from key
    const fileName = key.split("/").pop();
    const title = fileName.replace(/\.pdf$/i, "");

    // Generate recommendations
    const recommendations = generateRecommendations(title, summary);

    // Save the results to DynamoDB
    const timestamp = new Date().toISOString();
    await documentClient
      .update({
        TableName: process.env.PAPERS_TABLE,
        Key: { paperId },
        UpdateExpression: `
        SET status = :status,
            summary = :summary,
            keyPoints = :keyPoints,
            citation = :citation,
            recommendations = :recommendations,
            lastUpdated = :timestamp
      `,
        ExpressionAttributeValues: {
          ":status": "completed",
          ":summary": summary,
          ":keyPoints": keyPoints,
          ":citation": citation,
          ":recommendations": recommendations,
          ":timestamp": timestamp,
        },
      })
      .promise();

    // Send WebSocket message about completion
    if (process.env.NODE_ENV === "development") {
      console.log(
        `WebSocket message would be sent: Paper ${paperId} - Status: completed`
      );
    } else {
      // In production, send WebSocket message
    }

    // For development testing when manually invoking this function
    if (process.env.NODE_ENV === "development") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: true,
          message: "Paper processed successfully",
          paperId,
          status: "completed",
          summary: summary.substring(0, 100) + "...", // Preview of summary
        }),
      };
    }

    // For production S3 trigger, just return success
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Paper processed successfully",
        paperId,
      }),
    };
  } catch (error) {
    console.error("Error processing paper:", error);

    // For development testing
    if (process.env.NODE_ENV === "development") {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Error processing paper: " + error.message,
        }),
      };
    }

    // For production S3 trigger
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error processing paper: " + error.message,
      }),
    };
  }
};
