"use strict";
const {
  getS3Client,
  getDynamoDBClient,
  isDevelopment,
} = require("../../utils/aws-config");
require("dotenv").config();

module.exports.handler = async (event) => {
  try {
    const { paperId } = event.pathParameters;

    // 유효성 검사
    if (!paperId) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Paper ID is required",
        }),
      };
    }

    // 클라이언트 초기화
    const s3 = getS3Client();
    const documentClient = getDynamoDBClient();

    // Paper 레코드 가져오기
    const paperResult = await documentClient
      .get({
        TableName: process.env.PAPERS_TABLE,
        Key: { paperId },
      })
      .promise();

    if (!paperResult.Item) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Paper not found",
        }),
      };
    }

    const paper = paperResult.Item;

    // 요약 파일이 없는지 확인
    if (!paper.summaryKey) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Summary not found for this paper",
          paperStatus: paper.status || "unknown",
        }),
      };
    }

    // S3 미리 서명된 URL 생성
    const summaryUrl = s3.getSignedUrl("getObject", {
      Bucket: process.env.PAPERS_BUCKET,
      Key: paper.summaryKey,
      Expires: 3600, // 1시간 유효
    });

    // JSON 요약 파일이 있는 경우 URL도 생성
    let jsonUrl = null;
    if (paper.jsonKey) {
      jsonUrl = s3.getSignedUrl("getObject", {
        Bucket: process.env.PAPERS_BUCKET,
        Key: paper.jsonKey,
        Expires: 3600,
      });
    }

    // 원본 PDF URL 생성
    const pdfUrl = s3.getSignedUrl("getObject", {
      Bucket: process.env.PAPERS_BUCKET,
      Key: paper.fileKey,
      Expires: 3600,
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        summaryUrl,
        jsonUrl,
        pdfUrl,
        paperTitle: paper.title || "Untitled Paper",
        expiresIn: 3600,
      }),
    };
  } catch (error) {
    console.error("Error generating summary URL:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error generating summary URL",
        error: isDevelopment ? error.message : "Internal server error",
      }),
    };
  }
};
