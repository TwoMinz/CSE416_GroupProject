"use strict";
const jwt = require("jsonwebtoken");
const {
  getDynamoDBClient,
  getWebSocketClient,
  getLambdaClient,
  isDevelopment,
} = require("../../utils/aws-config");
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

// Send WebSocket message
const sendWebSocketMessage = async (connectionId, message) => {
  try {
    const websocketAPI = getWebSocketClient();

    if (isDevelopment) {
      console.log(
        `[CONFIRM-UPLOAD] [WEBSOCKET] Would send to ${connectionId}:`,
        message
      );
      return true;
    }

    await websocketAPI
      .postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify(message),
      })
      .promise();

    return true;
  } catch (error) {
    console.error(`[CONFIRM-UPLOAD] Error sending WebSocket message:`, error);
    return false;
  }
};

// Helper to trigger paper processing in development
const triggerPaperProcessing = async (paperId, fileKey, userId) => {
  const lambda = getLambdaClient();

  if (isDevelopment) {
    console.log(
      `[CONFIRM-UPLOAD] Would trigger paper processing for paperId: ${paperId}`
    );

    // In development, we can call the function directly for testing
    // This simulates what would happen when the PDF is uploaded to S3
    try {
      // Requires process-paper.js to be properly implemented for direct invocation
      const processPaperModule = require("../papers/process-paper");

      const testEvent = {
        body: JSON.stringify({
          paperId,
          fileKey,
          userId,
        }),
      };

      console.log(
        "[CONFIRM-UPLOAD] Directly invoking paper processing function"
      );
      const result = await processPaperModule.handler(testEvent);
      console.log("[CONFIRM-UPLOAD] Processing result:", result);

      return true;
    } catch (error) {
      console.error(
        "[CONFIRM-UPLOAD] Error in direct processing invocation:",
        error
      );
      return false;
    }
  } else {
    // In production, this would be triggered by an S3 event
    // But we can also manually invoke it if needed
    try {
      await lambda
        .invoke({
          FunctionName: `${process.env.SERVICE_NAME}-${process.env.STAGE}-processPaper`,
          InvocationType: "Event",
          Payload: JSON.stringify({
            paperId,
            fileKey,
            userId,
          }),
        })
        .promise();

      return true;
    } catch (error) {
      console.error("[CONFIRM-UPLOAD] Error invoking Lambda function:", error);
      return false;
    }
  }
};

module.exports.handler = async (event) => {
  try {
    console.log("[CONFIRM-UPLOAD] Processing upload confirmation");

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Parse request body
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { paperId, fileKey, uploadSuccess, fileName } = body;

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
      console.error("[CONFIRM-UPLOAD] Token verification failed:", error);
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

    const userId = decoded.userId;
    console.log(
      `[CONFIRM-UPLOAD] Confirmation from user ${userId} for paper ${paperId}`
    );

    // Validate input
    if (!paperId || !fileKey || uploadSuccess === undefined) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "PaperId, fileKey, and uploadSuccess are required",
        }),
      };
    }

    // Get paper record to verify ownership
    let paper;
    try {
      const paperResult = await documentClient
        .get({
          TableName: process.env.PAPERS_TABLE,
          Key: {
            paperId,
          },
        })
        .promise();

      if (!paperResult.Item) {
        return {
          statusCode: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
          },
          body: JSON.stringify({
            success: false,
            message: "Paper not found",
          }),
        };
      }

      paper = paperResult.Item;
    } catch (error) {
      console.error("[CONFIRM-UPLOAD] Error retrieving paper record:", error);
      throw new Error(`Failed to retrieve paper: ${error.message}`);
    }

    // Verify paper ownership
    if (paper.userId !== userId) {
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "You do not have permission to update this paper",
        }),
      };
    }

    // Update paper status based on upload result
    const timestamp = new Date().toISOString();
    let updateExpression = "SET lastUpdated = :timestamp";
    let expressionAttributeValues = {
      ":timestamp": timestamp,
    };

    if (uploadSuccess) {
      updateExpression += ", status = :status";
      expressionAttributeValues[":status"] = "processing";

      // Update title if provided
      if (fileName) {
        updateExpression += ", title = :title";
        expressionAttributeValues[":title"] = fileName;
      }
    } else {
      updateExpression += ", status = :status";
      expressionAttributeValues[":status"] = "failed";
    }

    try {
      await documentClient
        .update({
          TableName: process.env.PAPERS_TABLE,
          Key: {
            paperId,
          },
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: "ALL_NEW",
        })
        .promise();
      console.log(
        `[CONFIRM-UPLOAD] Updated paper status to: ${
          uploadSuccess ? "processing" : "failed"
        }`
      );
    } catch (error) {
      console.error("[CONFIRM-UPLOAD] Error updating paper status:", error);
      throw new Error(`Failed to update paper status: ${error.message}`);
    }

    // For successful uploads, trigger paper processing
    if (uploadSuccess) {
      console.log("[CONFIRM-UPLOAD] Upload successful, triggering processing");

      // In production, this would be handled by the S3 trigger
      // For development, we'll manually trigger the process
      const processingTriggered = await triggerPaperProcessing(
        paperId,
        fileKey,
        userId
      );

      if (!processingTriggered) {
        console.warn("[CONFIRM-UPLOAD] Failed to trigger paper processing");
      }

      // Get websocket connections for this user (if any) to send status updates
      // In a real implementation, you would retrieve active connections from a table
      if (isDevelopment) {
        // Simulate a WebSocket message
        await sendWebSocketMessage("dev-connection-id", {
          type: "PAPER_STATUS_UPDATE",
          paperId,
          status: "processing",
          message: "Paper processing started",
        });
      } else {
        // Production code to send WebSocket updates would go here
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        message: uploadSuccess
          ? "Upload confirmed, paper processing started"
          : "Upload failed status recorded",
        paperId,
        status: uploadSuccess ? "processing" : "failed",
      }),
    };
  } catch (error) {
    console.error("[CONFIRM-UPLOAD] Unhandled error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error confirming upload",
        error: isDevelopment ? error.message : "Internal server error",
      }),
    };
  }
};
