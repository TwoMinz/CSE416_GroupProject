const AWS = require("aws-sdk");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
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
    const expiresIn = parseInt(process.env.JWT_EXPIRATION) || 3600; // Default to 1 hour
    const refreshExpiresIn =
      parseInt(process.env.REFRESH_TOKEN_EXPIRATION) || 604800; // Default to 7 days

    const accessToken = jwt.sign(
      {
        userId: user.userId,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.userId,
        tokenId: uuidv4(),
      },
      process.env.JWT_SECRET,
      { expiresIn: refreshExpiresIn }
    );

    // Store refresh token (in a production environment, you would store this in a separate table)
    // For this example, we'll skip this step to keep it simple

    // Create user response object without password
    const userResponse = {
      userId: user.userId,
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
