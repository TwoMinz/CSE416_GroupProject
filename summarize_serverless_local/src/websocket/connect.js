"use strict";
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Configure DynamoDB for storing connections
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
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  try {
    // Get auth token from querystring
    const queryParams = event.queryStringParameters || {};
    const token = queryParams.token;

    if (!token) {
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

    // Store connection in DynamoDB
    await documentClient
      .put({
        TableName: process.env.CONNECTIONS_TABLE || "summaraize-connections",
        Item: {
          connectionId,
          userId,
          timestamp: new Date().toISOString(),
          endpoint: `https://${domainName}/${stage}`,
        },
      })
      .promise();

    console.log(`User ${userId} connected with connection ID ${connectionId}`);

    return { statusCode: 200, body: "Connected" };
  } catch (error) {
    console.error("Error in WebSocket connect handler:", error);
    return { statusCode: 500, body: "Error connecting: " + error.message };
  }
};
