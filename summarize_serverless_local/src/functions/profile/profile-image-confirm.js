"use strict";
const jwt = require("jsonwebtoken");
const { getDynamoDBClient, getS3Client } = require("../../utils/aws-config");
require("dotenv").config();

// Verify JWT token
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error(`Invalid token: ${error.message}`);
  }
};

module.exports.handler = async (event) => {
  try {
    console.log(
      "[PROFILE-IMAGE-CONFIRM] Processing profile image upload confirmation"
    );

    // 요청 본문 파싱
    const body =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { userId, fileKey, uploadSuccess } = body;

    // 입력 검증
    if (!userId || !fileKey || uploadSuccess === undefined) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "userId, fileKey, and uploadSuccess are required",
        }),
      };
    }

    // 토큰 추출 및 검증
    const authHeader =
      event.headers?.Authorization || event.headers?.authorization;
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

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      console.error(
        "[PROFILE-IMAGE-CONFIRM] Token verification failed:",
        error
      );
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

    // 사용자 권한 확인
    if (decoded.userId !== userId) {
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "You do not have permission to update this profile",
        }),
      };
    }

    // 업로드 실패 시 에러 반환
    if (!uploadSuccess) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Image upload failed",
        }),
      };
    }

    // S3 클라이언트 가져오기
    const s3 = getS3Client();

    // 파일 존재 여부 확인
    try {
      await s3
        .headObject({
          Bucket: process.env.PAPERS_BUCKET,
          Key: fileKey,
        })
        .promise();
    } catch (error) {
      console.error("[PROFILE-IMAGE-CONFIRM] File not found in S3:", error);
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Uploaded image file not found",
        }),
      };
    }

    // 프로필 이미지 URL 생성
    const profileImageUrl = s3.getSignedUrl("getObject", {
      Bucket: process.env.PAPERS_BUCKET,
      Key: fileKey,
      Expires: 31536000, // 1년 유효기간
    });

    // 데이터베이스 클라이언트 가져오기
    const documentClient = getDynamoDBClient();

    // userId 정수 변환
    const userIdNum = parseInt(userId);

    // 사용자 프로필 업데이트
    const result = await documentClient
      .update({
        TableName: process.env.USERS_TABLE,
        Key: { id: userIdNum },
        UpdateExpression:
          "SET profilePicture = :profilePicture, profileImageKey = :profileImageKey, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":profilePicture": profileImageUrl,
          ":profileImageKey": fileKey,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
      .promise();

    // 응답용 사용자 객체 생성
    const userResponse = {
      userId: result.Attributes.id,
      email: result.Attributes.email,
      username: result.Attributes.username,
      profilePicture: result.Attributes.profilePicture,
      transLang: result.Attributes.transLang,
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        message: "Profile image updated successfully",
        user: userResponse,
      }),
    };
  } catch (error) {
    console.error("[PROFILE-IMAGE-CONFIRM] Unhandled error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error updating profile image",
        error: error.message,
      }),
    };
  }
};
