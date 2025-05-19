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
    const { userId, fileType, fileName, imageData } = JSON.parse(event.body);

    // 입력 검증
    if (!userId || !fileType || !fileName || !imageData) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "userId, fileType, fileName, and imageData are required",
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

    // Base64 이미지 데이터 디코딩
    let imageBuffer;
    try {
      // Base64 데이터에서 'data:image/jpeg;base64,' 부분 제거
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
      imageBuffer = Buffer.from(base64Data, "base64");

      // 이미지 크기 제한 (5MB)
      if (imageBuffer.length > 5 * 1024 * 1024) {
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": true,
          },
          body: JSON.stringify({
            success: false,
            message: "Image size exceeds the 5MB limit",
          }),
        };
      }
    } catch (error) {
      console.error("[PROFILE-IMAGE-UPLOAD] Error decoding image data:", error);
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Invalid image data",
        }),
      };
    }

    // S3 클라이언트 가져오기
    const s3 = getS3Client();

    // 파일 키 생성 (프로필 이미지 전용 경로)
    const fileKey = `profiles/${userId}/${Date.now()}-${fileName}`;

    // 직접 S3에 이미지 업로드
    try {
      await s3
        .putObject({
          Bucket: process.env.PAPERS_BUCKET,
          Key: fileKey,
          Body: imageBuffer,
          ContentType: fileType,
          ACL: "public-read", // 공개적으로 읽기 가능하도록 설정
        })
        .promise();

      console.log(
        "[PROFILE-IMAGE-UPLOAD] Successfully uploaded image to S3:",
        fileKey
      );
    } catch (s3Error) {
      console.error("[PROFILE-IMAGE-UPLOAD] Error uploading to S3:", s3Error);
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Failed to upload image to storage",
          error: s3Error.message,
        }),
      };
    }

    // 이미지 URL 생성
    const imageUrl = s3.getSignedUrl("getObject", {
      Bucket: process.env.PAPERS_BUCKET,
      Key: fileKey,
      Expires: 31536000, // 1년 유효 (실제 환경에 맞게 조정)
    });

    // DynamoDB 클라이언트 가져오기
    const documentClient = getDynamoDBClient();

    // 사용자 프로필 업데이트
    try {
      const userIdNum = parseInt(userId);
      const result = await documentClient
        .update({
          TableName: process.env.USERS_TABLE,
          Key: { id: userIdNum },
          UpdateExpression:
            "SET profilePicture = :profilePicture, profileImageKey = :profileImageKey, updatedAt = :updatedAt",
          ExpressionAttributeValues: {
            ":profilePicture": imageUrl,
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
    } catch (dbError) {
      console.error("[PROFILE-IMAGE-UPLOAD] Database error:", dbError);

      // 실패 시 S3에서 업로드된 이미지 삭제 시도
      try {
        await s3
          .deleteObject({
            Bucket: process.env.PAPERS_BUCKET,
            Key: fileKey,
          })
          .promise();
      } catch (deleteError) {
        console.error(
          "[PROFILE-IMAGE-UPLOAD] Failed to delete S3 object after DB error:",
          deleteError
        );
      }

      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Database error while updating profile",
          error: dbError.message,
        }),
      };
    }
  } catch (error) {
    console.error("[PROFILE-IMAGE-UPLOAD] Unhandled error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error processing profile image",
        error: error.message,
      }),
    };
  }
};
