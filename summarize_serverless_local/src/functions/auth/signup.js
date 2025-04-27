const AWS = require("aws-sdk");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

// Configure AWS
const documentClient = new AWS.DynamoDB.DocumentClient({
  region: "ap-northeast-2",
});

module.exports.handler = async (event) => {
  try {
    const { email, password, username } = JSON.parse(event.body);
    console.log(
      "Email: ",
      email,
      " password: ",
      password,
      " username: ",
      username
    );

    // Validate input
    if (!email || !password || !username) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "Email, password, and username are required",
        }),
      };
    }

    // Check if user already exists
    const existingUser = await documentClient
      .query({
        TableName: process.env.USERS_TABLE,
        IndexName: "EmailIndex",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email,
        },
      })
      .promise();

    if (existingUser.Items && existingUser.Items.length > 0) {
      return {
        statusCode: 409,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          success: false,
          message: "User with this email already exists",
        }),
      };
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const userId = uuidv4();
    const createdAt = new Date().toISOString();

    const newUser = {
      userId,
      email,
      password: hashedPassword,
      username,
      profilePicture: "https://example.com/default-avatar.png", // Default profile picture
      transLang: 1, // Default language (1 = English)
      createdAt,
    };

    await documentClient
      .put({
        TableName: process.env.USERS_TABLE,
        Item: newUser,
      })
      .promise();

    // Remove password from response
    delete newUser.password;

    return {
      statusCode: 201,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: true,
        message: "User created successfully",
        user: newUser,
      }),
    };
  } catch (error) {
    console.error("Signup error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        success: false,
        message: "Error creating user",
      }),
    };
  }
};
