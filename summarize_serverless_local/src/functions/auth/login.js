"use strict";
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { getDynamoDBClient } = require("../../utils/aws-config");
require("dotenv").config();

module.exports.handler = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body);

    // Validate input
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Email and password are required",
        }),
      };
    }

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Find user by email
    const userResult = await documentClient
      .query({
        TableName: process.env.USERS_TABLE,
        IndexName: "EmailIndex",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email,
        },
      })
      .promise();

    if (!userResult.Items || userResult.Items.length === 0) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Invalid credentials",
        }),
      };
    }

    const user = userResult.Items[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Invalid credentials",
        }),
      };
    }

    // Generate JWT tokens
    const expiresIn = parseInt(process.env.JWT_EXPIRATION) || 3600;
    const refreshExpiresIn =
      parseInt(process.env.REFRESH_TOKEN_EXPIRATION) || 604800;

    const accessToken = jwt.sign(
      {
        userId: String(user.id),
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    const refreshToken = jwt.sign(
      {
        userId: String(user.id),
        tokenId: uuidv4(),
      },
      process.env.JWT_SECRET,
      { expiresIn: refreshExpiresIn }
    );

    const userResponse = {
      userId: String(user.id),
      email: user.email,
      username: user.username,
      profilePicture: user.profilePicture,
      transLang: user.transLang,
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        message: "Login successful",
        user: userResponse,
        accessToken,
        refreshToken,
        expiresIn,
      }),
    };
  } catch (error) {
    console.error("Login error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error during login",
      }),
    };
  }
};
