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

  const url = s3.getSignedUrl("getObject", {
    Bucket: process.env.PAPERS_BUCKET,
    Key: s3Key,
    Expires: 3600,
  });

  return url;
};

const getUserPapersWithPagination = async (
  userId,
  limit,
  lastEvaluatedKey = null,
  sortBy = "uploadDate",
  order = "desc"
) => {
  console.log(`[LOAD-LIBRARY] Starting query for user: ${userId}`);

  try {
    // 일단 모든 사용자 논문을 가져오기 (페이지네이션 없이)
    const allPapersResult = await documentClient
      .query({
        TableName: process.env.PAPERS_TABLE,
        IndexName: "UserIdIndex",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
      .promise();

    let allPapers = allPapersResult.Items || [];

    console.log(`[LOAD-LIBRARY] Total papers found: ${allPapers.length}`);

    // 각 논문의 업로드 날짜 로깅
    allPapers.forEach((paper, index) => {
      console.log(
        `[LOAD-LIBRARY] Paper ${index}: ${paper.title?.substring(0, 30)}... - ${
          paper.uploadDate
        } - Status: ${paper.status}`
      );
    });

    // 확실한 정렬
    allPapers.sort((a, b) => {
      const dateA = new Date(a.uploadDate || 0);
      const dateB = new Date(b.uploadDate || 0);

      if (order === "desc") {
        return dateB.getTime() - dateA.getTime(); // 최신순
      } else {
        return dateA.getTime() - dateB.getTime(); // 오래된순
      }
    });

    console.log(`[LOAD-LIBRARY] After sorting:`);
    allPapers.slice(0, 5).forEach((paper, index) => {
      console.log(
        `[LOAD-LIBRARY] Sorted Paper ${index}: ${paper.title?.substring(
          0,
          30
        )}... - ${paper.uploadDate}`
      );
    });

    // 간단한 offset 기반 페이지네이션
    let offset = 0;
    if (lastEvaluatedKey && typeof lastEvaluatedKey === "string") {
      try {
        const parsed = JSON.parse(lastEvaluatedKey);
        offset = parsed.offset || 0;
      } catch (e) {
        console.log(`[LOAD-LIBRARY] Invalid lastEvaluatedKey, starting from 0`);
        offset = 0;
      }
    }

    console.log(`[LOAD-LIBRARY] Using offset: ${offset}, limit: ${limit}`);

    const paginatedPapers = allPapers.slice(offset, offset + limit);
    const hasMore = offset + limit < allPapers.length;
    const nextOffset = offset + limit;

    console.log(
      `[LOAD-LIBRARY] Returning ${paginatedPapers.length} papers, hasMore: ${hasMore}`
    );

    return {
      papers: paginatedPapers,
      lastEvaluatedKey: hasMore ? { offset: nextOffset } : null,
      hasMore: hasMore,
    };
  } catch (error) {
    console.error(
      `[LOAD-LIBRARY] Error in getUserPapersWithPagination:`,
      error
    );
    throw error;
  }
};

module.exports.handler = async (event) => {
  try {
    console.log("[LOAD-LIBRARY] Processing library load request");
    console.log("[LOAD-LIBRARY] Event body:", event.body);

    // Parse request body
    const {
      userId,
      limit = 10,
      sortBy = "uploadDate",
      order = "desc",
      lastEvaluatedKey = null,
    } = JSON.parse(event.body);

    console.log("[LOAD-LIBRARY] Parsed request:", {
      userId,
      limit,
      sortBy,
      order,
      lastEvaluatedKey: lastEvaluatedKey ? "PROVIDED" : "NULL",
    });

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

    // Verify the authenticated user matches the requested userId
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

    const userIdString = String(userId);

    // 페이지네이션으로 논문 가져오기
    const result = await getUserPapersWithPagination(
      userIdString,
      limit,
      lastEvaluatedKey,
      sortBy,
      order
    );

    // Format the response
    const formattedPapers = result.papers.map((paper) => {
      let thumbnailUrl;
      if (paper.fileKey) {
        thumbnailUrl = getPresignedUrl(paper.fileKey);
      } else {
        thumbnailUrl = "https://example.com/placeholder.jpg";
      }

      return {
        id: paper.id || paper.paperId,
        title: paper.title || "Untitled Paper",
        uploadDate: paper.uploadDate,
        lastUpdated: paper.lastUpdated,
        status: paper.status || "unknown",
        thumbnailUrl,
        s3Key: paper.fileKey,
        starred: paper.starred || false,
      };
    });

    // 페이지네이션 정보 준비
    const paginationInfo = {
      hasMore: result.hasMore,
      lastEvaluatedKey: result.lastEvaluatedKey
        ? JSON.stringify(result.lastEvaluatedKey)
        : null,
      currentCount: formattedPapers.length,
      requestedLimit: limit,
    };

    console.log("[LOAD-LIBRARY] Final response:", {
      success: true,
      papersCount: formattedPapers.length,
      pagination: paginationInfo,
      papersByStatus: formattedPapers.reduce((acc, paper) => {
        const status = paper.status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
      samplePapers: formattedPapers.slice(0, 3).map((p) => ({
        id: p.id,
        title: p.title?.substring(0, 30) + "...",
        status: p.status,
      })),
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
        pagination: paginationInfo,
      }),
    };
  } catch (error) {
    console.error("[LOAD-LIBRARY] Error loading library:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error loading library",
        error: error.message,
      }),
    };
  }
};
