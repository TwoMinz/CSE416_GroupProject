"use strict";
const jwt = require("jsonwebtoken");
const { getDynamoDBClient } = require("../utils/aws-config");
require("dotenv").config();

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

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Store connection in DynamoDB
    await documentClient
      .put({
        TableName: process.env.CONNECTIONS_TABLE,
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
