"use strict";
const AWS = require("aws-sdk");
const {
  getDynamoDBClient,
  getWebSocketClient,
} = require("../utils/aws-config");
require("dotenv").config();

module.exports.handler = async (event) => {
  console.log("WebSocket paperProcessStatus event:", event);

  const connectionId = event.requestContext.connectionId;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  try {
    // Parse the message
    const body = JSON.parse(event.body);
    const { paperId } = body;

    if (!paperId) {
      return sendError(connectionId, domainName, stage, "paperId is required");
    }

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Get the connection record to find userId
    const connectionResult = await documentClient
      .get({
        TableName: process.env.CONNECTIONS_TABLE || "summaraize-connections",
        Key: { connectionId },
      })
      .promise();

    if (!connectionResult.Item) {
      return sendError(connectionId, domainName, stage, "Connection not found");
    }

    const userId = connectionResult.Item.userId;

    // Get paper info from DynamoDB
    const paperResult = await documentClient
      .get({
        TableName: process.env.CONNECTIONS_TABLE,
        Key: { paperId },
      })
      .promise();

    if (!paperResult.Item) {
      return sendError(connectionId, domainName, stage, "Paper not found");
    }

    const paper = paperResult.Item;

    // Verify ownership
    if (paper.userId !== userId) {
      return sendError(
        connectionId,
        domainName,
        stage,
        "You don't have permission to view this paper"
      );
    }

    // Send the paper status
    const message = {
      type: "PAPER_STATUS",
      paperId,
      status: paper.status || "unknown",
      title: paper.title || "Untitled Paper",
      lastUpdated: paper.lastUpdated,
      errorMessage: paper.errorMessage,
    };

    // Send message back to client
    const apiGateway = new AWS.ApiGatewayManagementApi({
      apiVersion: "2018-11-29",
      endpoint: `${domainName}/${stage}`,
    });

    await apiGateway
      .postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify(message),
      })
      .promise();

    return { statusCode: 200, body: "Message sent" };
  } catch (error) {
    console.error("Error in paperProcessStatus handler:", error);
    return {
      statusCode: 500,
      body: "Error processing status: " + error.message,
    };
  }
};

// Helper to send error response
async function sendError(connectionId, domainName, stage, errorMessage) {
  try {
    const apiGateway = new AWS.ApiGatewayManagementApi({
      apiVersion: "2018-11-29",
      endpoint: `${domainName}/${stage}`,
    });

    await apiGateway
      .postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          type: "ERROR",
          message: errorMessage,
        }),
      })
      .promise();

    return { statusCode: 400, body: errorMessage };
  } catch (error) {
    console.error("Error sending WebSocket error message:", error);
    return { statusCode: 500, body: "Error sending response" };
  }
}
