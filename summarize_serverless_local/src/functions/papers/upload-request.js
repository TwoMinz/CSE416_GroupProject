"use strict";
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Configure AWS
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || "localhost",
  endpoint:
    process.env.NODE_ENV === "development"
      ? "http://localhost:4569" // Endpoint for serverless-s3-local
      : undefined,
  s3ForcePathStyle: process.env.NODE_ENV === "development", // Required for local development
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

// Verify JWT token
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error("Invalid token");
  }
};

module.exports.handler = async (event) => {
  try {
    // Parse request body
    const { fileName, fileType, fileSize } = JSON.parse(event.body);

    // Extract authorization token
    const authHeader =
      event.headers.Authorization || event.headers.authorization;
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

    // Validate input
    if (!fileName || !fileType) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "File name and type are required",
        }),
      };
    }

    // Only allow PDF files
    if (fileType !== "application/pdf") {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Only PDF files are allowed",
        }),
      };
    }

    // Generate unique paper ID and S3 key
    const paperId = uuidv4();
    const fileKey = `papers/${userId}/${paperId}/${fileName}`;

    // Generate pre-signed URL
    const expiresIn = 300; // 5 minutes

    // For local development, use direct upload config
    // For production, use the presigned URL approach
    let uploadConfig;

    if (process.env.NODE_ENV === "development") {
      // Generate direct upload config for local development
      uploadConfig = {
        url: `http://localhost:4569/${process.env.PAPERS_BUCKET}`,
        fields: {
          key: fileKey,
          bucket: process.env.PAPERS_BUCKET,
          "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
          "X-Amz-Credential":
            "LOCAL_ACCESS_KEY/20250422/localhost/s3/aws4_request",
          "X-Amz-Date": "20250422T000000Z",
          "X-Amz-Signature": "local_signature",
          Policy: "local_policy",
        },
      };
    } else {
      // Create a pre-signed URL for production
      uploadConfig = s3.createPresignedPost({
        Bucket: process.env.PAPERS_BUCKET,
        Fields: {
          key: fileKey,
        },
        Expires: expiresIn,
        Conditions: [
          ["content-length-range", 0, 10 * 1024 * 1024], // up to 10 MB
        ],
      });
    }

    // Create a new paper entry in DynamoDB
    const timestamp = new Date().toISOString();
    const paperItem = {
      paperId,
      userId,
      title: fileName, // Use filename as initial title
      fileKey,
      status: "pending", // Initial status
      uploadDate: timestamp,
      lastUpdated: timestamp,
    };

    await documentClient
      .put({
        TableName: process.env.PAPERS_TABLE,
        Item: paperItem,
      })
      .promise();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        paperId,
        fileKey,
        uploadUrl: uploadConfig.url,
        directUploadConfig: uploadConfig,
        expiresIn,
      }),
    };
  } catch (error) {
    console.error("Error generating upload URL:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error generating upload URL",
      }),
    };
  }
};
