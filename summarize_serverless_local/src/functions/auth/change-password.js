"use strict";
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getDynamoDBClient } = require("../../utils/aws-config");
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

module.exports.handler = async (event) => {
  try {
    console.log("[CHANGE-PASSWORD] Processing password change request");

    // Parse request body
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { userId, newPassword, currentPassword } = body;

    // Validate input
    if (!userId || !newPassword) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "User ID and new password are required",
        }),
      };
    }

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
      console.error("[CHANGE-PASSWORD] Token verification failed:", error);
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

    // Verify the authenticated user matches the requested userId
    if (decoded.userId !== userId) {
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "You are not authorized to change this password",
        }),
      };
    }

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Get the user from DynamoDB
    const userResult = await documentClient
      .get({
        TableName: process.env.USERS_TABLE,
        Key: { userId },
      })
      .promise();

    if (!userResult.Item) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "User not found",
        }),
      };
    }

    const user = userResult.Item;

    // If the user was created with Google Auth and doesn't have a password yet, we can skip this check
    if (user.password && currentPassword) {
      // Verify current password if provided
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!isPasswordValid) {
        return {
          statusCode: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
          },
          body: JSON.stringify({
            success: false,
            message: "Current password is incorrect",
          }),
        };
      }
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the password
    const result = await documentClient
      .update({
        TableName: process.env.USERS_TABLE,
        Key: { userId },
        UpdateExpression: "SET password = :password, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":password": hashedPassword,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
      .promise();

    // Create user response object (without sensitive data)
    const userResponse = {
      userId: result.Attributes.userId,
      email: result.Attributes.email,
      username: result.Attributes.username,
      profilePicture: result.Attributes.profilePicture,
      transLang: result.Attributes.transLang,
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        message: "Password updated successfully",
        user: userResponse,
      }),
    };
  } catch (error) {
    console.error("[CHANGE-PASSWORD] Unhandled error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error updating password",
      }),
    };
  }
};
