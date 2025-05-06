"use strict";
const jwt = require("jsonwebtoken");
const { getS3Client, getDynamoDBClient } = require("../../utils/aws-config");
require("dotenv").config();

// Verify JWT token
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error(`Invalid token: ${error.message}`);
  }
};

module.exports.handler = async (event) => {
  try {
    console.log("[GET-CONTENT-URL] Processing request");

    // Get paperId from path parameter
    const paperId = event.pathParameters.paperId;

    // Extract authorization token
    const authHeader =
      event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Authorization token is required",
        }),
      };
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify user
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      console.error("[GET-CONTENT-URL] Token verification failed:", error);
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Invalid authorization token",
        }),
      };
    }

    const userId = decoded.userId;

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Get paper details from DynamoDB
    const paperResult = await documentClient
      .get({
        TableName: process.env.PAPERS_TABLE,
        Key: { id: parseInt(paperId) },
      })
      .promise();

    if (!paperResult.Item) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Paper not found",
        }),
      };
    }

    const paper = paperResult.Item;

    // Verify ownership
    if (paper.userId != userId) {
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "You do not have permission to access this paper",
        }),
      };
    }

    // Get S3 client
    const s3 = getS3Client();

    // Generate presigned URL for PDF file
    const pdfUrl = s3.getSignedUrl("getObject", {
      Bucket: process.env.PAPERS_BUCKET,
      Key: paper.fileKey,
      Expires: 3600, // 1 hour
    });

    // Generate presigned URL for summary file if available
    let summaryUrl = null;
    if (paper.summaryKey) {
      summaryUrl = s3.getSignedUrl("getObject", {
        Bucket: process.env.PAPERS_BUCKET,
        Key: paper.summaryKey,
        Expires: 3600, // 1 hour
      });
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        pdfUrl: pdfUrl,
        summaryUrl: summaryUrl,
        expiresIn: 3600,
      }),
    };
  } catch (error) {
    console.error("[GET-CONTENT-URL] Unhandled error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error generating content URLs",
      }),
    };
  }
};
