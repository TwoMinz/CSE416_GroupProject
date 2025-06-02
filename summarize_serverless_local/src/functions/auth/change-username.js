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
    console.log("[CHANGE-USERNAME] Processing username change request");

    // Parse request body
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { userId, newUserId } = body;

    console.log("[CHANGE-USERNAME] Request details:", { userId, newUserId });

    // Validate input
    if (!userId || !newUserId) {
      console.log("[CHANGE-USERNAME] Missing required fields");
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "User ID and new username are required",
        }),
      };
    }

    // Validate username format
    const trimmedUsername = newUserId.trim();
    if (trimmedUsername.length === 0) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Username cannot be empty",
        }),
      };
    }

    if (trimmedUsername.length < 2) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Username must be at least 2 characters long",
        }),
      };
    }

    if (trimmedUsername.length > 50) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Username cannot be longer than 50 characters",
        }),
      };
    }

    // Extract authorization token
    const authHeader =
      event.headers?.Authorization || event.headers?.authorization;
    if (!authHeader) {
      console.log("[CHANGE-USERNAME] No authorization header");
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
      console.error("[CHANGE-USERNAME] Token verification failed:", error);
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
    const tokenUserId = String(decoded.userId);
    const requestUserId = String(userId);

    console.log("[CHANGE-USERNAME] User verification:", {
      tokenUserId,
      requestUserId,
    });

    if (tokenUserId !== requestUserId) {
      console.log("[CHANGE-USERNAME] User ID mismatch");
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "You are not authorized to change this username",
        }),
      };
    }

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // First, get the current user to check if username is actually changing
    const currentUserResult = await documentClient
      .get({
        TableName: process.env.USERS_TABLE,
        Key: { id: parseInt(userId) },
      })
      .promise();

    if (!currentUserResult.Item) {
      console.log("[CHANGE-USERNAME] User not found");
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "User not found",
        }),
      };
    }

    const currentUser = currentUserResult.Item;

    // Check if username is actually changing
    if (currentUser.username === trimmedUsername) {
      console.log(
        "[CHANGE-USERNAME] Username unchanged, returning current user"
      );
      const userResponse = {
        userId: String(currentUser.id),
        email: currentUser.email,
        username: currentUser.username,
        profilePicture: currentUser.profilePicture,
        transLang: currentUser.transLang,
      };

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: true,
          message: "Username is already set to this value",
          user: userResponse,
        }),
      };
    }

    // Check if the new username is already taken by another user
    console.log(
      "[CHANGE-USERNAME] Checking if username is available:",
      trimmedUsername
    );

    const existingUser = await documentClient
      .scan({
        TableName: process.env.USERS_TABLE,
        FilterExpression: "username = :username AND id <> :currentUserId",
        ExpressionAttributeValues: {
          ":username": trimmedUsername,
          ":currentUserId": parseInt(userId),
        },
      })
      .promise();

    if (existingUser.Items && existingUser.Items.length > 0) {
      console.log("[CHANGE-USERNAME] Username already taken");
      return {
        statusCode: 409,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Username already taken",
        }),
      };
    }

    // Update the username
    console.log("[CHANGE-USERNAME] Updating username to:", trimmedUsername);

    const result = await documentClient
      .update({
        TableName: process.env.USERS_TABLE,
        Key: { id: parseInt(userId) },
        UpdateExpression: "SET username = :username, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":username": trimmedUsername,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
      .promise();

    console.log("[CHANGE-USERNAME] Username updated successfully");

    // Create user response object (without sensitive data)
    const userResponse = {
      userId: String(result.Attributes.id),
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
        message: "Username updated successfully",
        user: userResponse,
      }),
    };
  } catch (error) {
    console.error("[CHANGE-USERNAME] Unhandled error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error updating username",
      }),
    };
  }
};
