// Centralized AWS Configuration
const AWS = require("aws-sdk");
require("dotenv").config();

// Default configuration for development environment
const isDevelopment = process.env.NODE_ENV === "development";

// DynamoDB configuration
const getDynamoDBClient = () => {
  return new AWS.DynamoDB.DocumentClient({
    region: process.env.AWS_REGION || "localhost",
    endpoint: isDevelopment ? "http://localhost:8000" : undefined,
    accessKeyId: isDevelopment ? "LOCAL_ACCESS_KEY" : undefined,
    secretAccessKey: isDevelopment ? "LOCAL_SECRET_KEY" : undefined,
  });
};

// DynamoDB (raw) configuration
const getDynamoDB = () => {
  return new AWS.DynamoDB({
    region: process.env.AWS_REGION || "localhost",
    endpoint: isDevelopment ? "http://localhost:8000" : undefined,
    accessKeyId: isDevelopment ? "LOCAL_ACCESS_KEY" : undefined,
    secretAccessKey: isDevelopment ? "LOCAL_SECRET_KEY" : undefined,
  });
};

// S3 configuration
const getS3Client = () => {
  return new AWS.S3({
    region: process.env.AWS_REGION || "localhost",
    endpoint: isDevelopment ? "http://localhost:4569" : undefined, // S3 local endpoint
    s3ForcePathStyle: isDevelopment, // Required for local development
    accessKeyId: isDevelopment ? "LOCAL_ACCESS_KEY" : undefined,
    secretAccessKey: isDevelopment ? "LOCAL_SECRET_KEY" : undefined,
  });
};

// WebSocket API Gateway configuration
const getWebSocketClient = () => {
  if (!isDevelopment) {
    return new AWS.ApiGatewayManagementApi({
      apiVersion: "2018-11-29",
      endpoint: process.env.WEBSOCKET_API_URL,
    });
  }

  // For development, we'll use a mock WebSocket client
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

// Lambda client for invoking other functions
const getLambdaClient = () => {
  if (!isDevelopment) {
    return new AWS.Lambda({
      region: process.env.AWS_REGION,
    });
  }

  // For development, we'll use local HTTP calls instead
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
};
