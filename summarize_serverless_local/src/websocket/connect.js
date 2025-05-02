"use strict";
const jwt = require("jsonwebtoken");
const AWS = require("aws-sdk"); // Make sure AWS is imported
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

// Generate a numeric ID from a string
const generateNumericId = (str) => {
  // Use the first 10 digits from the string, or pad with random digits if needed
  const digits = str.replace(/\D/g, "");

  if (digits.length >= 10) {
    return parseInt(digits.substring(0, 10), 10);
  }

  // If not enough digits, pad with random numbers
  let result = digits;
  while (result.length < 10) {
    result += Math.floor(Math.random() * 10);
  }

  return parseInt(result, 10);
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

    // Generate a numeric ID from the connection ID
    const numericId = generateNumericId(connectionId);
    console.log(
      `Generated numeric ID: ${numericId} from connectionId: ${connectionId}`
    );

    // Store connection in DynamoDB with the numeric id as the primary key
    await documentClient
      .put({
        TableName: process.env.CONNECTIONS_TABLE,
        Item: {
          id: numericId, // Numeric ID as required by schema
          connectionId: connectionId, // Store the original connection ID as attribute
          userId: userId,
          timestamp: new Date().toISOString(),
          endpoint: `https://${domainName}/${stage}`,
        },
      })
      .promise();

    console.log(
      `User ${userId} connected with connection ID ${connectionId} and numeric ID ${numericId}`
    );

    return { statusCode: 200, body: "Connected" };
  } catch (error) {
    console.error("Error in WebSocket connect handler:", error);
    return { statusCode: 500, body: "Error connecting: " + error.message };
  }
};
