"use strict";
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const { OpenAI } = require("openai");
const pdfParse = require("pdf-parse");
const {
  getS3Client,
  getDynamoDBClient,
  getWebSocketClient,
  isDevelopment,
  useActualAwsResources,
} = require("../../utils/aws-config");
require("dotenv").config();

// Send WebSocket message about paper processing status
const sendStatusUpdate = async (userId, paperId, status, message) => {
  try {
    const websocketAPI = getWebSocketClient();

    // In development, just log the message
    if (isDevelopment) {
      console.log(
        `[PROCESS-PAPER] [WEBSOCKET] Status update for paper ${paperId}: ${status} - ${message}`
      );
      return true;
    }

    // In production, we would get active connections for this user from a table
    // and send the message to each connection
    // This is a placeholder for the actual implementation
    // You would need to implement a DynamoDB query to get connections for the user

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

// OpenAI API를 사용하여 구조화된 요약 생성
const generateStructuredSummary = async (text, paperId, userId) => {
  try {
    await sendStatusUpdate(
      userId,
      paperId,
      "analyzing",
      "Analyzing paper content..."
    );

    // OpenAI 클라이언트 초기화
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 텍스트가 너무 길면 청크로 나눔
    const chunks = chunkText(text, 12000); // OpenAI 토큰 한도에 맞게 조정

    await sendStatusUpdate(
      userId,
      paperId,
      "summarizing",
      `Processing ${chunks.length} text chunks...`
    );

    let paperData = {};

    // 첫 번째 청크로 기본 정보 추출
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

    // 모든 청크에서 핵심 포인트 추출
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

    // 마지막으로 전체 요약 및 인용 정보 생성
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

    // 모든 데이터 결합
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

// 텍스트를 청크로 나누는 유틸리티 함수
const chunkText = (text, maxLength) => {
  const chunks = [];
  let currentChunk = "";

  // 단락별로 분할
  const paragraphs = text.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    // 단락 자체가 maxLength보다 길면 강제 분할
    if (paragraph.length > maxLength) {
      // 현재 청크가 있으면 추가
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      // 긴 단락 분할 (문장 단위)
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
    // 현재 청크에 단락을 추가했을 때 최대 길이를 초과하는지 확인
    else if (currentChunk.length + paragraph.length + 2 > maxLength) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }
  }

  // 마지막 청크 추가
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
};

// JSON 응답을 마크다운으로 변환
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

    // 개발 환경에서는 로컬에도 저장
    if (isDevelopment) {
      const localS3Dir = path.join(
        process.cwd(),
        "local-s3-bucket",
        process.env.PAPERS_BUCKET
      );
      const filePath = path.join(localS3Dir, markdownKey);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, markdownContent);
      console.log(`[PROCESS-PAPER] Saved markdown file locally at ${filePath}`);
    }

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

    // 개발 환경에서는 로컬에도 저장
    if (isDevelopment) {
      const localS3Dir = path.join(
        process.cwd(),
        "local-s3-bucket",
        process.env.PAPERS_BUCKET
      );
      const filePath = path.join(localS3Dir, jsonKey);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));
      console.log(`[PROCESS-PAPER] Saved JSON file locally at ${filePath}`);
    }

    return jsonKey;
  } catch (error) {
    console.error("[PROCESS-PAPER] Error saving JSON to S3:", error);
    throw new Error(`Failed to save JSON to S3: ${error.message}`);
  }
};

// 메인 처리 함수
module.exports.handler = async (event) => {
  try {
    console.log("[PROCESS-PAPER] Starting paper processing");

    // 이벤트에서 정보 추출
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { paperId, fileKey, userId } = body;

    // 필요한 클라이언트 가져오기
    const s3 = getS3Client();
    const documentClient = getDynamoDBClient();

    // 상태 업데이트
    await sendStatusUpdate(
      userId,
      paperId,
      "started",
      "Starting paper processing"
    );

    // S3에서 PDF 파일 다운로드
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

      // 실패 상태 업데이트
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

    // PDF에서 텍스트 추출
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

      // 실패 상태 업데이트
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

    // OpenAI API로 요약 생성
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

      // 실패 상태 업데이트
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

    // JSON을 마크다운으로 변환
    const summaryMarkdown = convertToMarkdown(summaryJson);

    // S3에 JSON 및 마크다운 파일 저장
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

      // 실패 상태 업데이트
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

    // DynamoDB 업데이트
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
      // 이 부분에서 에러가 발생해도 파일은 이미 S3에 저장되었으므로, 완전 실패로 처리하지 않음
      await sendStatusUpdate(
        userId,
        paperId,
        "partial",
        "Summary generated but database update failed"
      );
      throw new Error(`Failed to update database record: ${error.message}`);
    }

    // 완료 상태 업데이트
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
        error: isDevelopment ? error.message : "Internal server error",
      }),
    };
  }
};
