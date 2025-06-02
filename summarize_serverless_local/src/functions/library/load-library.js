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

// 개선된 페이지네이션 함수
const getUserPapersWithPagination = async (
  userId,
  limit,
  lastEvaluatedKey = null,
  sortBy = "uploadDate",
  order = "desc"
) => {
  console.log(`[LOAD-LIBRARY] Starting pagination query for user: ${userId}`);
  console.log(
    `[LOAD-LIBRARY] Limit: ${limit}, lastEvaluatedKey:`,
    lastEvaluatedKey
  );

  let currentLastEvaluatedKey = lastEvaluatedKey;

  // lastEvaluatedKey 파싱 및 검증
  if (typeof lastEvaluatedKey === "string" && lastEvaluatedKey.trim() !== "") {
    try {
      currentLastEvaluatedKey = JSON.parse(lastEvaluatedKey);
      console.log(
        `[LOAD-LIBRARY] Parsed lastEvaluatedKey:`,
        currentLastEvaluatedKey
      );
    } catch (error) {
      console.error(`[LOAD-LIBRARY] Failed to parse lastEvaluatedKey:`, error);
      currentLastEvaluatedKey = null;
    }
  }

  // lastEvaluatedKey 구조 검증
  if (currentLastEvaluatedKey) {
    if (!currentLastEvaluatedKey.userId || !currentLastEvaluatedKey.id) {
      console.warn(
        `[LOAD-LIBRARY] Invalid lastEvaluatedKey structure, resetting to null`
      );
      currentLastEvaluatedKey = null;
    }
  }

  const queryParams = {
    TableName: process.env.PAPERS_TABLE,
    IndexName: "UserIdIndex",
    KeyConditionExpression: "userId = :userId",
    // 필터 완전 제거 - 모든 상태의 논문을 프론트엔드로 전송
    ExpressionAttributeValues: {
      ":userId": userId,
    },
    Limit: limit,
    ScanIndexForward: order === "asc",
  };

  if (currentLastEvaluatedKey) {
    queryParams.ExclusiveStartKey = currentLastEvaluatedKey;
    console.log(
      `[LOAD-LIBRARY] Using ExclusiveStartKey:`,
      currentLastEvaluatedKey
    );
  }

  console.log(`[LOAD-LIBRARY] Query params (no filtering):`, {
    TableName: queryParams.TableName,
    IndexName: queryParams.IndexName,
    KeyConditionExpression: queryParams.KeyConditionExpression,
    Limit: queryParams.Limit,
    ScanIndexForward: queryParams.ScanIndexForward,
    ExclusiveStartKey: queryParams.ExclusiveStartKey ? "SET" : "NULL",
  });

  try {
    const result = await documentClient.query(queryParams).promise();

    console.log(
      `[LOAD-LIBRARY] Query returned ${result.Items?.length || 0} items`
    );
    console.log(
      `[LOAD-LIBRARY] LastEvaluatedKey from DynamoDB:`,
      result.LastEvaluatedKey
    );

    let papers = result.Items || [];

    // 쿼리 결과의 각 논문 상태를 자세히 로깅
    console.log(
      `[LOAD-LIBRARY] Raw papers from DynamoDB:`,
      papers.map((p) => ({
        id: p.id,
        title: p.title?.substring(0, 30) + "...",
        status: p.status,
        uploadDate: p.uploadDate,
      }))
    );

    // 날짜순 정렬 (uploadDate 기준)
    papers.sort((a, b) => {
      const dateA = new Date(a.uploadDate || 0);
      const dateB = new Date(b.uploadDate || 0);
      return order === "desc"
        ? dateB.getTime() - dateA.getTime()
        : dateA.getTime() - dateB.getTime();
    });

    console.log(`[LOAD-LIBRARY] Sorted ${papers.length} papers`);

    // 상태별 논문 수 로깅
    const statusCounts = papers.reduce((acc, paper) => {
      const status = paper.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    console.log(`[LOAD-LIBRARY] Papers by status:`, statusCounts);

    // 결과 반환
    const resultData = {
      papers: papers,
      lastEvaluatedKey: result.LastEvaluatedKey || null,
      hasMore: !!result.LastEvaluatedKey,
    };

    console.log(`[LOAD-LIBRARY] Returning result:`, {
      papersCount: resultData.papers.length,
      hasMore: resultData.hasMore,
      lastEvaluatedKey: resultData.lastEvaluatedKey ? "EXISTS" : "NULL",
    });

    return resultData;
  } catch (error) {
    console.error(`[LOAD-LIBRARY] Error in DynamoDB query:`, error);
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
