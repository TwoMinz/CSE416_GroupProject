"use strict";
const jwt = require("jsonwebtoken");
const { getDynamoDBClient, getS3Client } = require("../../utils/aws-config");
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
    console.log(
      "[CHANGE-PROFILE-IMAGE] Processing profile image change request"
    );

    // Parse request body
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { userId, fileKey } = body;

    // Validate input
    if (!userId || !fileKey) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "User ID and file key are required",
        }),
      };
    }

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
      console.error("[CHANGE-PROFILE-IMAGE] Token verification failed:", error);
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

    // Verify the authenticated user matches the requested userId
    if (decoded.userId !== userId) {
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "You are not authorized to change this profile image",
        }),
      };
    }

    // Get S3 client to check if file exists
    const s3 = getS3Client();

    try {
      // Check if the file exists in S3
      await s3
        .headObject({
          Bucket: process.env.PAPERS_BUCKET,
          Key: fileKey,
        })
        .promise();
    } catch (error) {
      console.error("[CHANGE-PROFILE-IMAGE] File not found in S3:", error);
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Profile image file not found",
        }),
      };
    }

    // Generate a presigned URL for the profile image
    const profileImageUrl = s3.getSignedUrl("getObject", {
      Bucket: process.env.PAPERS_BUCKET,
      Key: fileKey,
      Expires: 31536000, // 1 year expiration for profile images
    });

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Update the profile image URL
    const result = await documentClient
      .update({
        TableName: process.env.USERS_TABLE,
        Key: { userId },
        UpdateExpression:
          "SET profilePicture = :profilePicture, profileImageKey = :profileImageKey, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":profilePicture": profileImageUrl,
          ":profileImageKey": fileKey,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
      .promise();

    // Create user response object (without sensitive data)
    const userResponse = {
      userId: result.Attributes.userId,
      email: result.Attributes.email,
      username: result.Attributes.username,
      profilePicture: result.Attributes.profilePicture,
      transLang: result.Attributes.transLang,
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        message: "Profile image updated successfully",
        user: userResponse,
      }),
    };
  } catch (error) {
    console.error("[CHANGE-PROFILE-IMAGE] Unhandled error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error updating profile image",
      }),
    };
  }
};
