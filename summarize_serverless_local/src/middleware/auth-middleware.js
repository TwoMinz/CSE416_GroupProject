"use strict";
const jwt = require("jsonwebtoken");
require("dotenv").config();

/**
 * Authentication middleware for serverless functions
 * @param {Function} handler - The Lambda handler function
 * @returns {Function} - The wrapped handler with authentication
 */
const authMiddleware = (handler) => {
  return async (event, context) => {
    try {
      // Skip auth check for development if needed
      if (
        process.env.NODE_ENV === "development" &&
        process.env.SKIP_AUTH === "true"
      ) {
        console.log("Skipping authentication in development mode");
        return await handler(event, context);
      }

      // Extract token from headers
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
            message: "No authorization token provided",
          }),
        };
      }

      // Verify JWT token
      const token = authHeader.replace("Bearer ", "");
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        return {
          statusCode: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
          },
          body: JSON.stringify({
            success: false,
            message: "Invalid or expired token",
          }),
        };
      }

      // Add user information to the event
      event.user = decoded;

      // Call the original handler
      return await handler(event, context);
    } catch (error) {
      console.error("Error in auth middleware:", error);

      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Authentication error",
        }),
      };
    }
  };
};

module.exports = authMiddleware;
