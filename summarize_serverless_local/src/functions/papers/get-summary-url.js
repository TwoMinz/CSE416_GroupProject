// src/functions/papers/get-summary-url.js
"use strict";
const { getS3Client, isDevelopment } = require("../../utils/aws-config");

module.exports.handler = async (event) => {
  try {
    const { paperId } = event.pathParameters;
    const s3 = getS3Client();

    // DynamoDB에서 summaryKey 가져오기
    const documentClient = getDynamoDBClient();
    const paperResult = await documentClient
      .get({
        TableName: process.env.PAPERS_TABLE,
        Key: { paperId },
      })
      .promise();

    if (!paperResult.Item || !paperResult.Item.summaryKey) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Summary not found",
        }),
      };
    }

    const summaryKey = paperResult.Item.summaryKey;

    // S3 미리 서명된 URL 생성
    const url = s3.getSignedUrl("getObject", {
      Bucket: process.env.PAPERS_BUCKET,
      Key: summaryKey,
      Expires: 3600, // 1시간 유효
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        summaryUrl: url,
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
