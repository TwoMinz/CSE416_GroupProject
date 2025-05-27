"use strict";
const jwt = require("jsonwebtoken");
const { getDynamoDBClient } = require("../../utils/aws-config");
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
    console.log("[UPDATE-PROFILE-URL] Processing profile image URL update");

    // Parse request body
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { userId, imageUrl } = body;

    // Validate input
    if (!userId || !imageUrl) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "userId and imageUrl are required",
        }),
      };
    }

    // Basic URL validation
    try {
      new URL(imageUrl);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Invalid image URL format",
        }),
      };
    }

    // Extract and verify authorization token
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

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      console.error("[UPDATE-PROFILE-URL] Token verification failed:", error);
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

    // Verify user permission
    if (decoded.userId !== userId) {
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "You do not have permission to update this profile",
        }),
      };
    }

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Update user profile in database
    const result = await documentClient
      .update({
        TableName: process.env.USERS_TABLE,
        Key: { id: parseInt(userId) },
        UpdateExpression:
          "SET profilePicture = :profilePicture, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":profilePicture": imageUrl,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
      .promise();

    // Create user response object (without sensitive data)
    const userResponse = {
      userId: String(result.Attributes.id),
      email: result.Attributes.email,
      username: result.Attributes.username,
      profilePicture: result.Attributes.profilePicture,
      transLang: result.Attributes.transLang,
    };

    console.log("[UPDATE-PROFILE-URL] Profile image URL updated successfully");

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
    console.error("[UPDATE-PROFILE-URL] Unhandled error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error updating profile image",
        error: error.message,
      }),
    };
  }
};
