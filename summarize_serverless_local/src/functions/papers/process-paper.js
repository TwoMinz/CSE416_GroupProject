"use strict";
const {
  getS3Client,
  getDynamoDBClient,
  getWebSocketClient,
} = require("../../utils/aws-config");
require("dotenv").config();

// Send WebSocket message about paper processing status
const sendStatusUpdate = async (userId, paperId, status, message) => {
  try {
    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Get user's active connections
    const connectionsResult = await documentClient
      .query({
        TableName: process.env.CONNECTIONS_TABLE,
        IndexName: "UserIdIndex",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
      .promise();

    if (!connectionsResult.Items || connectionsResult.Items.length === 0) {
      console.log(`[PROCESS-PAPER] No active connections for user ${userId}`);
      return true;
    }

    // Get WebSocket client
    const websocketAPI = getWebSocketClient();

    // Send message to all connections
    for (const connection of connectionsResult.Items) {
      try {
        // Use the connectionId from the item (not the id which is numeric)
        const connectionId = connection.connectionId;

        if (!connectionId) {
          console.warn(
            `[PROCESS-PAPER] Connection without connectionId found: ${JSON.stringify(
              connection
            )}`
          );
          continue;
        }

        console.log(
          `[PROCESS-PAPER] Sending status update to connection: ${connectionId}`
        );

        await websocketAPI
          .postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify({
              type: "PAPER_STATUS_UPDATE",
              paperId,
              status,
              message,
            }),
          })
          .promise();
      } catch (wsError) {
        if (wsError.statusCode === 410) {
          // Stale connection, remove it
          console.log(
            `[PROCESS-PAPER] Removing stale connection: ${
              connection.id || connection.connectionId
            }`
          );

          try {
            // Delete using the numeric id as the key
            await documentClient
              .delete({
                TableName: process.env.CONNECTIONS_TABLE,
                Key: { id: connection.id },
              })
              .promise();
          } catch (deleteError) {
            console.error(
              `[PROCESS-PAPER] Error deleting stale connection:`,
              deleteError
            );
          }
        } else {
          console.error("[PROCESS-PAPER] WebSocket error:", wsError);
        }
      }
    }

    return true;
  } catch (error) {
    console.error(
      `[PROCESS-PAPER] Error sending WebSocket status update:`,
      error
    );
    return false;
  }
};

// Process a paper - extract text, analyze, summarize, etc.
const processPaper = async (paperId, fileKey, userId) => {
  try {
    console.log(
      `[PROCESS-PAPER] Processing paper: ${paperId}, fileKey: ${fileKey}, userId: ${userId}`
    );

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Update status to processing
    await documentClient
      .update({
        TableName: process.env.PAPERS_TABLE,
        Key: { id: paperId },
        UpdateExpression: "SET #status = :status, lastUpdated = :timestamp",
        ExpressionAttributeValues: {
          ":status": "processing",
          ":timestamp": new Date().toISOString(),
        },
        ExpressionAttributeNames: {
          "#status": "status", // Handle reserved keyword
        },
      })
      .promise();

    // Send status update
    await sendStatusUpdate(
      userId,
      paperId,
      "processing",
      "Extracting text from PDF..."
    );

    // Get S3 client
    const s3 = getS3Client();

    // Download file from S3
    console.log(`[PROCESS-PAPER] Downloading file from S3: ${fileKey}`);
    const fileData = await s3
      .getObject({
        Bucket: process.env.PAPERS_BUCKET,
        Key: fileKey,
      })
      .promise();

    // In a real implementation, you would:
    // 1. Extract text from PDF using a library like pdf-parse
    // 2. Process text using OpenAI or similar
    // 3. Generate summary and other outputs
    // 4. Save results back to DynamoDB and/or S3

    // For this demo, we'll simulate these steps with delays

    // Simulate text extraction
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await sendStatusUpdate(
      userId,
      paperId,
      "analyzing",
      "Analyzing content..."
    );

    // Simulate content analysis
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await sendStatusUpdate(
      userId,
      paperId,
      "summarizing",
      "Generating summary..."
    );

    // Simulate summary generation
    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Create a sample summary (in a real app, this would come from AI)
    const sampleSummary = `# Sample Summary for ${paperId}
    
## Introduction
This is an automatically generated summary of the uploaded paper.

## Key Points
- First key point from the paper
- Second key point from the paper
- Third key point from the paper

## Conclusion
The paper concludes with important findings in this field.
`;

    // Upload summary to S3
    const summaryKey = `summaries/${userId}/${paperId}/summary.md`;
    await s3
      .putObject({
        Bucket: process.env.PAPERS_BUCKET,
        Key: summaryKey,
        Body: sampleSummary,
        ContentType: "text/markdown",
      })
      .promise();

    // Update paper record with summary and status
    await documentClient
      .update({
        TableName: process.env.PAPERS_TABLE,
        Key: { id: paperId },
        UpdateExpression:
          "SET #status = :status, summary = :summary, summaryKey = :summaryKey, lastUpdated = :timestamp",
        ExpressionAttributeValues: {
          ":status": "completed",
          ":summary": sampleSummary,
          ":summaryKey": summaryKey,
          ":timestamp": new Date().toISOString(),
        },
        ExpressionAttributeNames: {
          "#status": "status", // Handle reserved keyword
        },
      })
      .promise();

    // Send completion status
    await sendStatusUpdate(userId, paperId, "completed", "Summary ready!");

    return {
      success: true,
      paperId,
      status: "completed",
    };
  } catch (error) {
    console.error(`[PROCESS-PAPER] Error processing paper:`, error);

    try {
      // Update status to failed
      const documentClient = getDynamoDBClient();
      await documentClient
        .update({
          TableName: process.env.PAPERS_TABLE,
          Key: { id: paperId },
          UpdateExpression:
            "SET #status = :status, errorMessage = :error, lastUpdated = :timestamp",
          ExpressionAttributeValues: {
            ":status": "failed",
            ":error": error.message || "Unknown error",
            ":timestamp": new Date().toISOString(),
          },
          ExpressionAttributeNames: {
            "#status": "status", // Handle reserved keyword
          },
        })
        .promise();

      // Notify user of failure
      await sendStatusUpdate(
        userId,
        paperId,
        "failed",
        `Processing failed: ${error.message}`
      );
    } catch (updateError) {
      console.error(
        `[PROCESS-PAPER] Error updating failure status:`,
        updateError
      );
    }

    return {
      success: false,
      paperId,
      status: "failed",
      error: error.message,
    };
  }
};

module.exports.handler = async (event) => {
  try {
    console.log("[PROCESS-PAPER] Received event:", JSON.stringify(event));

    // Handle both direct invocation and S3 trigger formats
    let paperId, fileKey, userId;

    // Case 1: Direct Lambda invocation
    if (event.body) {
      // The body could be a string or an object
      const body =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;

      paperId = body.paperId;
      fileKey = body.fileKey;
      userId = body.userId;
    }
    // Case 2: S3 trigger
    else if (event.Records && event.Records[0].s3) {
      const s3Record = event.Records[0].s3;
      fileKey = s3Record.object.key;

      // Extract paperId and userId from the key path
      // Assuming format: uploads/{userId}/{paperId}/{filename}
      const keyParts = fileKey.split("/");
      if (keyParts.length >= 3) {
        userId = keyParts[1];
        paperId = keyParts[2];
      }
    }

    if (!paperId || !fileKey || !userId) {
      throw new Error(`Invalid event format. Missing required parameters. 
        paperId: ${paperId}, fileKey: ${fileKey}, userId: ${userId}`);
    }

    console.log(
      `[PROCESS-PAPER] Processing paper: ${paperId} for user: ${userId}`
    );

    // Continue with your processing logic...

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error("[PROCESS-PAPER] Unhandled error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
