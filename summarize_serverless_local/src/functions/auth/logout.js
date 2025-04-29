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
    console.log("[LOGOUT] Processing logout request");

    // Parse request body
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { user } = body;

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
      console.error("[LOGOUT] Token verification failed:", error);
      // Even if token verification fails, we'll still 'succeed' logout since
      // the goal is to end the session
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: true,
          message: "Logged out successfully despite invalid token",
        }),
      };
    }

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Optional: Check for refresh tokens in database and invalidate them
    // This would only be needed if you're storing refresh tokens server-side
    try {
      // Example - In a real implementation, you'd have a RefreshTokens table
      // await documentClient
      //   .delete({
      //     TableName: process.env.REFRESH_TOKENS_TABLE,
      //     Key: { userId: decoded.userId },
      //   })
      //   .promise();

      console.log(`[LOGOUT] User ${decoded.userId} logged out successfully`);
    } catch (dbError) {
      console.error("[LOGOUT] Error removing refresh tokens:", dbError);
      // Continue with logout even if DB operation fails
    }

    // Optional: Close WebSocket connections for this user
    try {
      // Get user's active connections
      const connectionsResult = await documentClient
        .query({
          TableName: process.env.CONNECTIONS_TABLE,
          IndexName: "UserIdIndex",
          KeyConditionExpression: "userId = :userId",
          ExpressionAttributeValues: {
            ":userId": decoded.userId,
          },
        })
        .promise();

      // Delete user's connections
      if (connectionsResult.Items && connectionsResult.Items.length > 0) {
        console.log(
          `[LOGOUT] Cleaning up ${connectionsResult.Items.length} WebSocket connections`
        );

        const deletePromises = connectionsResult.Items.map((connection) =>
          documentClient
            .delete({
              TableName: process.env.CONNECTIONS_TABLE,
              Key: { connectionId: connection.connectionId },
            })
            .promise()
        );

        await Promise.all(deletePromises);
      }
    } catch (wsError) {
      console.error(
        "[LOGOUT] Error cleaning up WebSocket connections:",
        wsError
      );
      // Continue with logout even if WebSocket cleanup fails
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        message: "Logged out successfully",
      }),
    };
  } catch (error) {
    console.error("[LOGOUT] Unhandled error:", error);

    // Return success anyway - we don't want to prevent users from logging out
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        message: "Logged out successfully despite error",
      }),
    };
  }
};
