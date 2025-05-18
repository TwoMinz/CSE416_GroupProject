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
    console.log(
      "[CHANGE-LANGUAGE] Processing language preference change request"
    );

    // Parse request body
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { userId, languageCode } = body;

    // Validate input
    if (!userId || languageCode === undefined) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "User ID and language code are required",
        }),
      };
    }

    // Validate language code (1=English, 2=Korean, 3=Spanish, 4=French)
    if (![1, 2, 3, 4].includes(Number(languageCode))) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Invalid language code. Must be 1, 2, 3, or 4.",
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
      console.error("[CHANGE-LANGUAGE] Token verification failed:", error);
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
          message:
            "You are not authorized to change this user's language setting",
        }),
      };
    }

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Update the language preference
    const result = await documentClient
      .update({
        TableName: process.env.USERS_TABLE,
        Key: { id: parseInt(userId) },
        UpdateExpression:
          "SET transLang = :languageCode, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":languageCode": Number(languageCode),
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
      .promise();

    // Create user response object (without sensitive data)
    const userResponse = {
      userId: result.Attributes.id,
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
        message: "Language preference updated successfully",
        user: userResponse,
      }),
    };
  } catch (error) {
    console.error("[CHANGE-LANGUAGE] Unhandled error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error updating language preference",
        error: error.message,
      }),
    };
  }
};
