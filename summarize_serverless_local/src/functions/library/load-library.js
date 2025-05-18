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

// Verify JWT token
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error("Invalid token");
  }
};

// Helper to get S3 presigned URL for paper thumbnail
const getPresignedUrl = (s3Key) => {
  const s3 = new AWS.S3({
    region: process.env.AWS_REGION || "localhost",
    endpoint:
      process.env.NODE_ENV === "development"
        ? "http://localhost:4569"
        : undefined,
    s3ForcePathStyle: process.env.NODE_ENV === "development",
    accessKeyId:
      process.env.NODE_ENV === "development" ? "LOCAL_ACCESS_KEY" : undefined,
    secretAccessKey:
      process.env.NODE_ENV === "development" ? "LOCAL_SECRET_KEY" : undefined,
  });

  // For production, generate a presigned URL
  const url = s3.getSignedUrl("getObject", {
    Bucket: process.env.PAPERS_BUCKET,
    Key: s3Key,
    Expires: 3600, // 1 hour
  });

  return url;
};

module.exports.handler = async (event) => {
  try {
    // Parse request body
    const {
      userId,
      page = 1,
      limit = 10,
      sortBy = "uploadDate",
      order = "desc",
    } = JSON.parse(event.body);

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

    // Verify the authenticated user matches the requested userId (using non-strict equality)
    if (String(decoded.userId) !== String(userId)) {
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "You are not authorized to access this library",
        }),
      };
    }

    // Ensure userId is a string for consistent DynamoDB querying
    const userIdString = String(userId);

    console.log(`Querying papers for user: ${userIdString}`);

    // Query papers for this user
    const queryResult = await documentClient
      .query({
        TableName: process.env.PAPERS_TABLE,
        IndexName: "UserIdIndex",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userIdString,
        },
      })
      .promise();

    // Apply sorting
    let papers = queryResult.Items || [];
    papers.sort((a, b) => {
      if (order.toLowerCase() === "asc") {
        return a[sortBy] > b[sortBy] ? 1 : -1;
      } else {
        return a[sortBy] < b[sortBy] ? 1 : -1;
      }
    });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedPapers = papers.slice(startIndex, endIndex);

    // Format the response
    const formattedPapers = paginatedPapers.map((paper) => {
      // Generate a thumbnail URL or use a placeholder
      let thumbnailUrl;
      if (paper.fileKey) {
        thumbnailUrl = getPresignedUrl(paper.fileKey);
      } else {
        // Use a placeholder image
        thumbnailUrl = "https://example.com/placeholder.jpg";
      }

      return {
        id: paper.id || paper.paperId,
        title: paper.title || "Untitled Paper",
        uploadDate: paper.uploadDate,
        status: paper.status || "unknown",
        thumbnailUrl,
        s3Key: paper.fileKey,
        starred: paper.starred || false,
      };
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        papers: formattedPapers,
        pagination: {
          totalPapers: papers.length,
          totalPages: Math.ceil(papers.length / limit),
          currentPage: page,
          limit,
        },
      }),
    };
  } catch (error) {
    console.error("Error loading library:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error loading library",
      }),
    };
  }
};
