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
      // Skip auth check for development if configured
      if (
        process.env.NODE_ENV === "development" &&
        process.env.SKIP_AUTH === "true"
      ) {
        console.log(
          "[AUTH MIDDLEWARE] Skipping authentication in development mode"
        );
        // Add a mock user for development
        event.user = {
          userId: "dev-user-id",
          email: "dev@example.com",
        };
        return await handler(event, context);
      }

      // Extract token from headers
      const authHeader =
        event.headers?.Authorization || event.headers?.authorization;

      if (!authHeader) {
        console.log("[AUTH MIDDLEWARE] No authorization token provided");
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
        console.log(
          `[AUTH MIDDLEWARE] Token verification failed: ${error.message}`
        );

        let errorMessage = "Invalid or expired token";

        // Provide more specific error messages
        if (error.name === "TokenExpiredError") {
          errorMessage = "Token has expired. Please login again.";
        } else if (error.name === "JsonWebTokenError") {
          errorMessage = "Invalid token format. Please login again.";
        }

        return {
          statusCode: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
          },
          body: JSON.stringify({
            success: false,
            message: errorMessage,
          }),
        };
      }

      // Add user information to the event
      event.user = decoded;
      console.log(`[AUTH MIDDLEWARE] Authenticated user: ${decoded.userId}`);

      // Call the original handler
      return await handler(event, context);
    } catch (error) {
      console.error("[AUTH MIDDLEWARE] Unexpected error:", error);

      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Authentication error",
          error:
            process.env.NODE_ENV === "development"
              ? error.message
              : "Internal server error",
        }),
      };
    }
  };
};

module.exports = authMiddleware;
