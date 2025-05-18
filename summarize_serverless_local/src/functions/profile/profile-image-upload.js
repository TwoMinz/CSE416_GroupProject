"use strict";
const { getS3Client, getDynamoDBClient } = require("../../utils/aws-config");
const jwt = require("jsonwebtoken");
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
      "[PROFILE-IMAGE-UPLOAD] Processing profile image upload request"
    );

    // 요청 본문 파싱
    const { userId, fileType, fileName, fileSize } = JSON.parse(event.body);

    // 입력 검증
    if (!userId || !fileType || !fileName || !fileSize) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "userId, fileType, fileName, and fileSize are required",
        }),
      };
    }

    // 이미지 파일 타입 검증
    const validImageTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/gif",
    ];
    if (!validImageTypes.includes(fileType)) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Only image files (JPEG, PNG, GIF) are allowed",
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
      console.error("[PROFILE-IMAGE-UPLOAD] Token verification failed:", error);
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
          message: "You do not have permission to upload for this user",
        }),
      };
    }

    // S3 클라이언트 가져오기
    const s3 = getS3Client();

    // 파일 키 생성 (프로필 이미지 전용 경로)
    const fileKey = `profiles/${userId}/${Date.now()}-${fileName}`;

    // S3 직접 업로드를 위한 사전 서명된 URL 생성
    const directUploadConfig = await s3.createPresignedPost({
      Bucket: process.env.PAPERS_BUCKET,
      Fields: {
        key: fileKey,
      },
      Conditions: [
        ["content-length-range", 0, 5 * 1024 * 1024], // 최대 5MB 제한
        ["starts-with", "$Content-Type", "image/"], // 이미지 파일만 허용
      ],
      Expires: 300, // 5분 유효
    });

    console.log(
      "[PROFILE-IMAGE-UPLOAD] Created presigned URL for file:",
      fileKey
    );

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        message: "Upload URL generated successfully",
        uploadUrl: directUploadConfig.url,
        fileKey,
        directUploadConfig,
      }),
    };
  } catch (error) {
    console.error("[PROFILE-IMAGE-UPLOAD] Error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error generating upload URL",
        error: error.message,
      }),
    };
  }
};
