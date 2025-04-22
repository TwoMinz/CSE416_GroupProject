"use strict";
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const {
  getS3Client,
  getDynamoDBClient,
  getWebSocketClient,
  isDevelopment,
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

    return true;
  } catch (error) {
    console.error(
      `[PROCESS-PAPER] Error sending WebSocket status update:`,
      error
    );
    return false;
  }
};

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
