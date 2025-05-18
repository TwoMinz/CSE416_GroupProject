"use strict";
const jwt = require("jsonwebtoken");
const { getDynamoDBClient } = require("../../utils/aws-config");
require("dotenv").config();

module.exports.handler = async (event) => {
  try {
    console.log("[REFRESH-TOKEN] Processing token refresh request");

    // Parse request body
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { refreshToken } = body;

    // 리프레시 토큰 검증
    if (!refreshToken) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Refresh token is required",
        }),
      };
    }

    // 리프레시 토큰 디코딩 및 검증
    let decodedRefreshToken;
    try {
      decodedRefreshToken = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
      console.error("[REFRESH-TOKEN] Invalid refresh token:", error.message);

      // 토큰 만료 여부에 따른 상세 에러 메시지
      let errorMessage = "Invalid refresh token";
      if (error.name === "TokenExpiredError") {
        errorMessage = "Refresh token has expired. Please login again.";
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

    // userId 추출
    const userId = decodedRefreshToken.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Invalid refresh token format",
        }),
      };
    }

    // DynamoDB에서 사용자 정보 조회
    const documentClient = getDynamoDBClient();
    const userResult = await documentClient
      .get({
        TableName: process.env.USERS_TABLE,
        Key: { id: Number(userId) },
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

    // Optional: 리프레시 토큰 블랙리스트 체크
    // 실제 구현에서는 토큰 블랙리스트나 토큰 버전 관리 메커니즘이 필요할 수 있음

    // 새 액세스 토큰 생성 (짧은 유효 기간)
    const expiresIn = parseInt(process.env.JWT_EXPIRATION) || 3600; // 1시간

    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    // 사용자 응답 객체 생성 (민감한 정보 제외)
    const userResponse = {
      userId: user.id,
      email: user.email,
      username: user.username,
      profilePicture: user.profilePicture,
      transLang: user.transLang,
    };

    // 토큰 갱신 로그 기록 (선택 사항)
    console.log(`[REFRESH-TOKEN] Token refreshed for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        message: "Token refreshed successfully",
        user: userResponse,
        accessToken,
        expiresIn,
      }),
    };
  } catch (error) {
    console.error("[REFRESH-TOKEN] Unhandled error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error refreshing token",
      }),
    };
  }
};
