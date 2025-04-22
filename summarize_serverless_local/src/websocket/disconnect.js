"use strict";
const AWS = require("aws-sdk");
require("dotenv").config();

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
    // Remove connection from DynamoDB
    await documentClient
      .delete({
        TableName: process.env.CONNECTIONS_TABLE || "summaraize-connections",
        Key: { connectionId },
      })
      .promise();

    console.log(`Connection ${connectionId} disconnected`);

    return { statusCode: 200, body: "Disconnected" };
  } catch (error) {
    console.error("Error in WebSocket disconnect handler:", error);
    return { statusCode: 500, body: "Error disconnecting: " + error.message };
  }
};
