"use strict";
const AWS = require("aws-sdk");
require("dotenv").config();

// DynamoDB 클라이언트 가져오기
const getDynamoDBClient = () => {
  return new AWS.DynamoDB.DocumentClient({
    region: process.env.AWS_REGION || "ap-northeast-2",
  });
};

// DynamoDB 기본 클라이언트
const getDynamoDB = () => {
  return new AWS.DynamoDB({
    region: process.env.AWS_REGION || "ap-northeast-2",
  });
};

// S3 클라이언트
const getS3Client = () => {
  return new AWS.S3({
    region: process.env.AWS_REGION || "ap-northeast-2",
  });
};

// WebSocket API Gateway 클라이언트
const getWebSocketClient = () => {
  // WebSocket API 엔드포인트 검증
  const endpoint = process.env.WEBSOCKET_API_URL;
  if (!endpoint) {
    console.error("WebSocket API URL is not configured");
    // 빈 모의 객체 반환
    return {
      postToConnection: () => ({
        promise: () => Promise.resolve({ statusCode: 200 }),
      }),
    };
  }

  return new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint,
  });
};

// Lambda 클라이언트
const getLambdaClient = () => {
  return new AWS.Lambda({
    region: process.env.AWS_REGION || "ap-northeast-2",
  });
};

module.exports = {
  getDynamoDBClient,
  getDynamoDB,
  getS3Client,
  getWebSocketClient,
  getLambdaClient,
};
