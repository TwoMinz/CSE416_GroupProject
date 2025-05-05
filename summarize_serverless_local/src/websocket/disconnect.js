"use strict";
const AWS = require("aws-sdk");
require("dotenv").config();

// Generate a numeric ID from a string (same function as in connect.js)
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

// Configure DynamoDB
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

module.exports.handler = async (event) => {
  console.log("WebSocket disconnect event:", event);

  const connectionId = event.requestContext.connectionId;

  try {
    // Generate the numeric ID from the connection ID
    const numericId = generateNumericId(connectionId);
    console.log(
      `Generated numeric ID: ${numericId} from connectionId: ${connectionId}`
    );

    // Remove connection from DynamoDB using the numeric ID
    await documentClient
      .delete({
        TableName: process.env.CONNECTIONS_TABLE,
        Key: { id: numericId },
      })
      .promise();

    console.log(`Connection ${connectionId} (ID: ${numericId}) disconnected`);

    return { statusCode: 200, body: "Disconnected" };
  } catch (error) {
    console.error("Error in WebSocket disconnect handler:", error);
    return { statusCode: 500, body: "Error disconnecting: " + error.message };
  }
};
