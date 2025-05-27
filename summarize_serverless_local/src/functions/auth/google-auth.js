"use strict";
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const { getDynamoDBClient } = require("../../utils/aws-config");
require("dotenv").config();

module.exports.handler = async (event) => {
  try {
    console.log("[GOOGLE-AUTH] Processing Google authentication request");

    // Get code from query parameters
    const code = event.queryStringParameters?.code;

    if (!code) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Authorization code is required",
        }),
      };
    }

    // Exchange code for tokens
    let tokenResponse;
    try {
      tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      });
    } catch (error) {
      console.error(
        "[GOOGLE-AUTH] Error exchanging code for tokens:",
        error.response?.data || error.message
      );
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Failed to exchange authorization code",
        }),
      };
    }

    const { access_token, id_token } = tokenResponse.data;

    // Get user info from Google
    let userInfo;
    try {
      const userInfoResponse = await axios.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );
      userInfo = userInfoResponse.data;
    } catch (error) {
      console.error(
        "[GOOGLE-AUTH] Error getting user info:",
        error.response?.data || error.message
      );
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Failed to get user information from Google",
        }),
      };
    }

    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Check if user exists
    const existingUser = await documentClient
      .query({
        TableName: process.env.USERS_TABLE,
        IndexName: "EmailIndex",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": userInfo.email,
        },
      })
      .promise();

    let user;

    if (existingUser.Items && existingUser.Items.length > 0) {
      // User exists, update last login
      user = existingUser.Items[0];

      await documentClient
        .update({
          TableName: process.env.USERS_TABLE,
          Key: { id: user.id },
          UpdateExpression: "SET lastLogin = :lastLogin",
          ExpressionAttributeValues: {
            ":lastLogin": new Date().toISOString(),
          },
        })
        .promise();
    } else {
      // Create new user - userId should be a number
      const userId = Date.now() + Math.floor(Math.random() * 1000);
      const newUser = {
        id: userId, // Use numeric ID consistent with other parts
        email: userInfo.email,
        username: userInfo.name || userInfo.email.split("@")[0],
        profilePicture: userInfo.picture || DEFAULT_PROFILE_IMAGE, // Google 프로필 이미지가 없으면 기본 이미지 사용
        transLang: 1, // Default language (1 = English)
        authProvider: "google",
        googleId: userInfo.sub,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };

      await documentClient
        .put({
          TableName: process.env.USERS_TABLE,
          Item: newUser,
        })
        .promise();

      user = newUser;
    }

    // Generate JWT tokens
    const expiresIn = parseInt(process.env.JWT_EXPIRATION) || 3600;
    const refreshExpiresIn =
      parseInt(process.env.REFRESH_TOKEN_EXPIRATION) || 604800;

    const accessToken = jwt.sign(
      {
        userId: String(user.id), // Convert to string for consistency
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

    // Create user response object (without sensitive data)
    const userResponse = {
      userId: String(user.id), // Ensure consistent string format
      email: user.email,
      username: user.username,
      profilePicture: user.profilePicture,
      transLang: user.transLang,
    };

    console.log("[GOOGLE-AUTH] User response prepared:", userResponse);

    // Encode user data for URL transmission
    const encodedUser = encodeURIComponent(JSON.stringify(userResponse));

    // Redirect to the dedicated OAuth callback route
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}&refreshToken=${refreshToken}&user=${encodedUser}`;

    console.log(
      "[GOOGLE-AUTH] Redirecting to OAuth callback:",
      redirectUrl.substring(0, 100) + "..."
    );

    return {
      statusCode: 302,
      headers: {
        Location: redirectUrl,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        message: "Google authentication successful",
        user: userResponse,
        accessToken,
        refreshToken,
        expiresIn,
      }),
    };
  } catch (error) {
    console.error("[GOOGLE-AUTH] Unhandled error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error during Google authentication",
      }),
    };
  }
};
