"use strict";
const jwt = require("jsonwebtoken");
const {
  getDynamoDBClient,
  getLambdaClient,
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

// Trigger paper processing
const triggerPaperProcessing = async (paperId, fileKey, userId) => {
  const lambda = getLambdaClient();

  console.log("[CONFIRM-UPLOAD] Triggering paper processing with:", {
    paperId,
    fileKey,
    userId,
    functionName: `${process.env.SERVICE_NAME || "summaraize-backend"}-${
      process.env.STAGE || "dev"
    }-processPaper`,
  });

  try {
    const payload = {
      paperId: paperId,
      fileKey: fileKey,
      userId: userId,
    };

    await lambda
      .invoke({
        FunctionName: `${process.env.SERVICE_NAME || "summaraize-backend"}-${
          process.env.STAGE || "dev"
        }-processPaper`,
        InvocationType: "Event",
        Payload: JSON.stringify(payload),
      })
      .promise();

    return true;
  } catch (error) {
    console.error("[CONFIRM-UPLOAD] Error invoking Lambda function:", error);
    return false;
  }
};

const markPaperAsFailed = async (paperId, errorMessage) => {
  try {
    const documentClient = getDynamoDBClient();

    const paperIdKey =
      typeof paperId === "string" && !isNaN(parseInt(paperId))
        ? parseInt(paperId)
        : paperId;

    console.log(
      `[MARK-FAILED] Marking paper ${paperIdKey} as failed: ${errorMessage}`
    );

    await documentClient
      .update({
        TableName: process.env.PAPERS_TABLE,
        Key: { id: paperIdKey },
        UpdateExpression:
          "SET #status = :status, errorMessage = :errorMessage, lastUpdated = :timestamp",
        ExpressionAttributeValues: {
          ":status": "failed",
          ":errorMessage":
            errorMessage || "Processing failed due to unknown error",
          ":timestamp": new Date().toISOString(),
        },
        ExpressionAttributeNames: {
          "#status": "status",
        },
      })
      .promise();

    console.log(
      `[MARK-FAILED] Paper ${paperIdKey} marked as failed successfully`
    );

    return true;
  } catch (updateError) {
    console.error(
      `[MARK-FAILED] Failed to mark paper ${paperId} as failed:`,
      updateError
    );
    return false;
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

    const userId = String(decoded.userId);
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
            id: paperId,
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
    if (paper.userId != userId) {
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
    let expressionAttributeNames = {};

    if (uploadSuccess) {
      updateExpression += ", #status = :status";
      expressionAttributeValues[":status"] = "processing";
      expressionAttributeNames["#status"] = "status";

      // Update title if provided
      if (fileName) {
        updateExpression += ", title = :title";
        expressionAttributeValues[":title"] = fileName;
      }
    } else {
      updateExpression += ", #status = :status";
      expressionAttributeValues[":status"] = "failed";
      expressionAttributeNames["#status"] = "status";
    }

    try {
      await documentClient
        .update({
          TableName: process.env.PAPERS_TABLE,
          Key: {
            id: paperId,
          },
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionAttributeValues,
          ExpressionAttributeNames: expressionAttributeNames,
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

      const processingTriggered = await triggerPaperProcessing(
        paperId,
        fileKey,
        userId
      );

      if (!processingTriggered) {
        console.warn("[CONFIRM-UPLOAD] Failed to trigger paper processing");
        await markPaperAsFailed(paperId, "Failed to start processing");
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

    try {
      const body =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      const { paperId } = body;

      if (paperId) {
        await markPaperAsFailed(
          paperId,
          `Unexpected error in confirm upload: ${error.message}`
        );
      }
    } catch (markError) {
      console.error(
        "[CONFIRM-UPLOAD] Failed to mark paper as failed:",
        markError
      );
    }

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error confirming upload",
        error: error.message,
      }),
    };
  }
};
