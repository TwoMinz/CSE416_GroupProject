"use strict";
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Configure AWS
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

// Setup WebSocket API
const ApiGatewayManagementApi = AWS.ApiGatewayManagementApi;
let websocketAPI;

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
  try {
    // Parse request body
    const { paperId, fileKey, uploadSuccess, fileName } = JSON.parse(
      event.body
    );

    // Extract authorization token
    const authHeader =
      event.headers.Authorization || event.headers.authorization;
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

    const paper = paperResult.Item;

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

    // For successful uploads, trigger paper processing
    if (uploadSuccess) {
      // In a real implementation, you would trigger the Lambda function
      // that processes the PDF and generates summaries
      // For development, we'll just simulate this with a success message

      // In production, this would be handled by the S3 trigger
      // or you could directly invoke the Lambda function here

      // Get websocket connections for this user (if any) to send status updates
      try {
        // Initialize WebSocket API (would only be relevant in production)
        if (process.env.NODE_ENV !== "development") {
          websocketAPI = new ApiGatewayManagementApi({
            apiVersion: "2018-11-29",
            endpoint: process.env.WEBSOCKET_API_URL,
          });

          // In production, you would get connections from a table and send updates
          // This is just a placeholder for the real implementation
        }
      } catch (error) {
        console.error("WebSocket error:", error);
        // Continue even if WebSocket update fails
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
    console.error("Error confirming upload:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error confirming upload",
      }),
    };
  }
};
