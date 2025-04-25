// AWS 설정 중앙화
const AWS = require("aws-sdk");
require("dotenv").config();

// 개발 환경인지 확인
const isDevelopment = process.env.NODE_ENV === "development";
// 실제 AWS 리소스를 사용할지 여부
const useActualAwsResources = process.env.USE_ACTUAL_AWS_RESOURCES === "true";

// DynamoDB 설정
const getDynamoDBClient = () => {
  // 개발 환경이지만 실제 AWS 리소스 사용 설정이 켜져 있는 경우
  if (isDevelopment && useActualAwsResources) {
    return new AWS.DynamoDB.DocumentClient({
      region: "ap-northeast-2",
    });
  }

  // 일반 개발 환경 (로컬 DynamoDB 사용)
  if (isDevelopment) {
    return new AWS.DynamoDB.DocumentClient({
      region: "localhost",
      endpoint: "http://localhost:8000",
      accessKeyId: process.env.ACCESS_KEY,
      secretAccessKey: process.env.SECRET_KEY,
    });
  }

  // 프로덕션 환경
  return new AWS.DynamoDB.DocumentClient({
    region: "ap-northeast-2",
  });
};

// DynamoDB (raw) 설정
const getDynamoDB = () => {
  if (isDevelopment && useActualAwsResources) {
    return new AWS.DynamoDB({
      region: "ap-northeast-2",
    });
  }

  if (isDevelopment) {
    return new AWS.DynamoDB({
      region: process.env.AWS_REGION || "localhost",
      endpoint: "http://localhost:8000",
      accessKeyId: process.env.ACCESS_KEY,
      secretAccessKey: process.env.SECRET_KEY,
    });
  }

  return new AWS.DynamoDB({
    region: "ap-northeast-2",
  });
};

// S3 설정
const getS3Client = () => {
  if (isDevelopment && useActualAwsResources) {
    return new AWS.S3({
      region: "ap-northeast-2",
    });
  }

  if (isDevelopment) {
    return new AWS.S3({
      region: "ap-northeast-2",
      endpoint: "http://localhost:4569",
      s3ForcePathStyle: true,
      accessKeyId: process.env.ACCESS_KEY,
      secretAccessKey: process.env.SECRET_KEY,
    });
  }

  return new AWS.S3({
    region: process.env.AWS_REGION,
  });
};

// WebSocket API Gateway 설정
const getWebSocketClient = () => {
  if (!isDevelopment || (isDevelopment && useActualAwsResources)) {
    // 실제 WebSocket API 사용
    const endpoint = process.env.WEBSOCKET_API_URL;
    if (endpoint) {
      return new AWS.ApiGatewayManagementApi({
        apiVersion: "2018-11-29",
        endpoint,
      });
    }
  }

  // 개발 환경에서는 모의 WebSocket 클라이언트 사용
  return {
    postToConnection: (params) => {
      console.log(
        `[MOCK WEBSOCKET] Sending message to ${params.ConnectionId}:`,
        params.Data.toString()
      );
      return {
        promise: () => Promise.resolve({ statusCode: 200 }),
      };
    },
  };
};

// Lambda 클라이언트
const getLambdaClient = () => {
  if (!isDevelopment || (isDevelopment && useActualAwsResources)) {
    return new AWS.Lambda({
      region: process.env.AWS_REGION,
    });
  }

  // 개발 환경에서는 모의 Lambda 호출 사용
  return {
    invoke: (params) => {
      console.log(
        `[MOCK LAMBDA] Would invoke ${params.FunctionName} with payload:`,
        params.Payload
      );
      return {
        promise: () =>
          Promise.resolve({
            StatusCode: 200,
            Payload: JSON.stringify({
              statusCode: 200,
              body: JSON.stringify({ success: true }),
            }),
          }),
      };
    },
  };
};

module.exports = {
  getDynamoDBClient,
  getDynamoDB,
  getS3Client,
  getWebSocketClient,
  getLambdaClient,
  isDevelopment,
  useActualAwsResources,
};
