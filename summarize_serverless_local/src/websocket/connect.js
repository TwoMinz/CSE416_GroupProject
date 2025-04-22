"use strict";
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Configure AWS DynamoDB
// In a real implementation, you'd have a separate table for WebSocket connections
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
  console.log("WebSocket connect event:", event);

  const connectionId = event.requestContext.connectionId;

  try {
    // Get auth token from querystring
    const queryParams = event.queryStringParameters || {};
    const token = queryParams.token;

    if (!token) {
      console.log("No token provided");
      // For development, allow connections without tokens
      if (process.env.NODE_ENV === "development") {
        console.log("Development mode: Allowing connection without token");
        return { statusCode: 200, body: "Connected (development mode)" };
      }

      return { statusCode: 401, body: "Unauthorized" };
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      console.error("Invalid token:", error);
      return { statusCode: 401, body: "Unauthorized" };
    }

    const userId = decoded.userId;

    // In production, store connection details in DynamoDB
    // For development, just log it
    if (process.env.NODE_ENV === "development") {
      console.log(
        `Development mode: User ${userId} connected with connection ID ${connectionId}`
      );
    } else {
      // In a real implementation, you would save to a WebSocket connections table
      // Example implementation:
      /*
      await documentClient.put({
        TableName: 'websocket-connections',
        Item: {
          connectionId,
          userId,
          timestamp: new Date().toISOString()
        }
      }).promise();
      */
    }

    return { statusCode: 200, body: "Connected" };
  } catch (error) {
    console.error("Error in WebSocket connect handler:", error);
    return { statusCode: 500, body: "Error connecting: " + error.message };
  }
};
