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

// failed 상태가 아닌 논문들을 페이지네이션으로 가져오는 함수
const getUserPapersWithPagination = async (
  userId,
  limit,
  lastEvaluatedKey = null,
  sortBy = "uploadDate",
  order = "desc"
) => {
  let papers = [];
  let currentLastEvaluatedKey = lastEvaluatedKey;
  let queryCount = 0;
  const maxQueries = 5; // 무한 루프 방지

  console.log(`[LOAD-LIBRARY] Fetching ${limit} papers for user: ${userId}`);
  console.log(`[LOAD-LIBRARY] Starting from key:`, lastEvaluatedKey);

  // lastEvaluatedKey 검증 및 파싱
  if (typeof lastEvaluatedKey === "string") {
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
    // GSI UserIdIndex를 사용하므로 userId와 원본 테이블의 기본 키(id)가 필요
    if (!currentLastEvaluatedKey.userId || !currentLastEvaluatedKey.id) {
      console.warn(
        `[LOAD-LIBRARY] Invalid lastEvaluatedKey structure, resetting to null`
      );
      console.log(
        `[LOAD-LIBRARY] Expected: {userId: string, id: number}, Got:`,
        currentLastEvaluatedKey
      );
      currentLastEvaluatedKey = null;
    }
  }

  while (papers.length < limit && queryCount < maxQueries) {
    queryCount++;

    const queryParams = {
      TableName: process.env.PAPERS_TABLE,
      IndexName: "UserIdIndex",
      KeyConditionExpression: "userId = :userId",
      // DynamoDB에서 failed 상태 제외
      FilterExpression: "#status <> :failedStatus",
      ExpressionAttributeValues: {
        ":userId": userId,
        ":failedStatus": "failed",
      },
      ExpressionAttributeNames: {
        "#status": "status",
      },
      Limit: limit * 3, // failed를 고려해서 더 많이 가져오기 (2배 -> 3배로 증가)
      // ScanIndexForward 제거 - JavaScript에서 정렬할 예정
    };

    if (currentLastEvaluatedKey) {
      queryParams.ExclusiveStartKey = currentLastEvaluatedKey;
    }

    console.log(`[LOAD-LIBRARY] Query ${queryCount} params:`, {
      ...queryParams,
      ExclusiveStartKey: queryParams.ExclusiveStartKey ? "SET" : "NULL",
    });

    try {
      const result = await documentClient.query(queryParams).promise();

      console.log(
        `[LOAD-LIBRARY] Query ${queryCount} returned ${
          result.Items?.length || 0
        } items`
      );
      console.log(
        `[LOAD-LIBRARY] LastEvaluatedKey:`,
        result.LastEvaluatedKey ? "EXISTS" : "NULL"
      );

      if (result.Items && result.Items.length > 0) {
        // 중복 제거: 이미 가져온 논문 ID와 비교
        const existingIds = new Set(papers.map((p) => p.id));
        const newItems = result.Items.filter(
          (item) => !existingIds.has(item.id)
        );

        console.log(
          `[LOAD-LIBRARY] Query ${queryCount} returned ${result.Items.length} items, ${newItems.length} are new`
        );
        papers.push(...newItems);
      } else {
        console.log(`[LOAD-LIBRARY] Query ${queryCount} returned no items`);
      }

      currentLastEvaluatedKey = result.LastEvaluatedKey;

      // 더 이상 데이터가 없으면 중단
      if (!currentLastEvaluatedKey) {
        break;
      }
    } catch (error) {
      console.error(`[LOAD-LIBRARY] Error in query ${queryCount}:`, error);

      // ValidationException인 경우 키를 null로 재설정하고 다시 시도
      if (error.code === "ValidationException" && queryCount === 1) {
        console.log(
          `[LOAD-LIBRARY] ValidationException on first query, retrying without ExclusiveStartKey`
        );
        currentLastEvaluatedKey = null;
        continue;
      }

      break;
    }
  }

  // 간단하고 확실한 정렬 - uploadDate 기준 최신순
  papers.sort((a, b) => {
    const dateA = new Date(a.uploadDate || 0);
    const dateB = new Date(b.uploadDate || 0);

    // 최신 날짜가 먼저 오도록 (내림차순)
    return dateB.getTime() - dateA.getTime();
  });

  console.log(
    `[LOAD-LIBRARY] Sorted ${papers.length} papers by uploadDate (newest first)`
  );
  if (papers.length > 0) {
    console.log(
      `[LOAD-LIBRARY] Newest paper: ${papers[0].title} - ${papers[0].uploadDate}`
    );
    if (papers.length > 1) {
      console.log(
        `[LOAD-LIBRARY] Second paper: ${papers[1].title} - ${papers[1].uploadDate}`
      );
    }
  }

  // 정확히 limit 개수만큼 자르기
  const limitedPapers = papers.slice(0, limit);

  console.log(
    `[LOAD-LIBRARY] Returning ${limitedPapers.length} papers after filtering`
  );

  return {
    papers: limitedPapers,
    lastEvaluatedKey: currentLastEvaluatedKey,
    hasMore: currentLastEvaluatedKey !== null || papers.length > limit,
  };
};

module.exports.handler = async (event) => {
  try {
    console.log("[LOAD-LIBRARY] Processing library load request");

    // Parse request body
    const {
      userId,
      limit = 10,
      sortBy = "uploadDate",
      order = "desc",
      lastEvaluatedKey = null, // 프론트에서 다음 페이지 로드할 때 전달
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

    // 개선된 페이지네이션으로 논문 가져오기
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
          hasMore: result.hasMore,
          lastEvaluatedKey: result.lastEvaluatedKey
            ? JSON.stringify(result.lastEvaluatedKey)
            : null, // JSON 문자열로 직렬화
          currentCount: formattedPapers.length,
          requestedLimit: limit,
        },
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
