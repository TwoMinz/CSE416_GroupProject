"use strict";
const { nanoid } = require("nanoid");
const { getS3Client, getDynamoDBClient } = require("../../utils/aws-config");
const jwt = require("jsonwebtoken");
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
    console.log("[UPLOAD-REQUEST] Processing file upload request");

    // Parse request body
    const { fileName, fileType, fileSize } = JSON.parse(event.body);

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
      console.error("[UPLOAD-REQUEST] Token verification failed:", error);
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

    // Generate unique ID for paper
    const paperId = nanoid(16);
    const userId = decoded.userId;
    const now = new Date().toISOString();

    // Generate file key (path in S3)
    const fileKey = `uploads/${userId}/${paperId}/${fileName}`;

    // Get S3 client
    const s3 = getS3Client();

    // Generate pre-signed URL for direct upload to S3
    const params = {
      Bucket: process.env.PAPERS_BUCKET,
      Key: fileKey,
      ContentType: fileType,
      Expires: 600, // URL expires in 10 minutes
    };

    // Generate direct upload configuration (S3 presigned post)
    const directUploadConfig = await s3.createPresignedPost({
      Bucket: process.env.PAPERS_BUCKET,
      Fields: {
        key: fileKey,
      },
      Conditions: [
        ["content-length-range", 0, 10 * 1024 * 1024], // 10MB file size limit
        ["starts-with", "$Content-Type", "application/"],
      ],
      Expires: 600,
    });

    // Create paper record in DynamoDB
    const documentClient = getDynamoDBClient();
    await documentClient
      .put({
        TableName: process.env.PAPERS_TABLE,
        Item: {
          paperId,
          userId,
          title: fileName,
          fileKey,
          uploadDate: now,
          status: "pending",
          fileSize,
          fileType,
          lastUpdated: now,
        },
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
        message: "Upload URL generated successfully",
        uploadUrl: directUploadConfig.url,
        fileKey,
        paperId,
        expiresIn: 600,
        directUploadConfig,
      }),
    };
  } catch (error) {
    console.error("[UPLOAD-REQUEST] Error:", error);

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
