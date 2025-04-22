const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Configure local DynamoDB
const dynamoDB = new AWS.DynamoDB({
  region: "localhost",
  endpoint: "http://localhost:8000",
  accessKeyId: "LOCAL_ACCESS_KEY", // Can be any value for local
  secretAccessKey: "LOCAL_SECRET_KEY", // Can be any value for local
});

const documentClient = new AWS.DynamoDB.DocumentClient({
  region: "localhost",
  endpoint: "http://localhost:8000",
  accessKeyId: "LOCAL_ACCESS_KEY",
  secretAccessKey: "LOCAL_SECRET_KEY",
});

// Table definitions matching serverless.yml
const TABLES = [
  {
    TableName: process.env.USERS_TABLE || "summaraize-users-dev",
    KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "email", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "EmailIndex",
        KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
        Projection: {
          ProjectionType: "ALL",
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  },
  {
    TableName: process.env.PAPERS_TABLE || "summaraize-papers-dev",
    KeySchema: [{ AttributeName: "paperId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "paperId", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "UserIdIndex",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        Projection: {
          ProjectionType: "ALL",
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  },
];

// Ensure resources/dynamodb-seed directory exists
const seedDir = path.join(__dirname, "resources", "dynamodb-seed");
if (!fs.existsSync(seedDir)) {
  fs.mkdirSync(seedDir, { recursive: true });
}

// Sample data for Users
const sampleUsers = [
  {
    userId: "user1",
    email: "test@example.com",
    password: "$2a$10$qP3F7Cr3Kj0hvdYjRWYpJOFBvkwSLNxwvKoG4B7ahmAy83z0rNnBS", // hashed 'password123'
    username: "TestUser",
    profilePicture: "https://example.com/default.jpg",
    transLang: 1,
    createdAt: new Date().toISOString(),
  },
];

// Sample data for Papers
const samplePapers = [
  {
    paperId: "paper1",
    userId: "user1",
    title: "Sample Research Paper",
    fileKey: "papers/user1/sample-paper.pdf",
    summary: "This is a sample summary of the research paper.",
    keyPoints: [
      { text: "Key point 1", page: 1 },
      { text: "Key point 2", page: 3 },
    ],
    citation: {
      authors: ["Author One", "Author Two"],
      year: 2024,
      publisher: "Sample Journal",
      apa: "Author One, & Author Two. (2024). Sample Research Paper. Sample Journal.",
      mla: 'Author One and Author Two. "Sample Research Paper." Sample Journal, 2024.',
    },
    uploadDate: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  },
];

// Create seed files
fs.writeFileSync(
  path.join(seedDir, "users.json"),
  JSON.stringify(sampleUsers, null, 2)
);

fs.writeFileSync(
  path.join(seedDir, "papers.json"),
  JSON.stringify(samplePapers, null, 2)
);

// Function to create tables
const createTables = async () => {
  for (const tableDefinition of TABLES) {
    try {
      console.log(`Creating table: ${tableDefinition.TableName}`);
      await dynamoDB.createTable(tableDefinition).promise();
      console.log(`Table created: ${tableDefinition.TableName}`);
    } catch (error) {
      if (error.code === "ResourceInUseException") {
        console.log(`Table already exists: ${tableDefinition.TableName}`);
      } else {
        console.error(
          `Error creating table ${tableDefinition.TableName}:`,
          error
        );
      }
    }
  }
};

// Function to insert sample data
const insertSampleData = async () => {
  // Insert sample users
  for (const user of sampleUsers) {
    try {
      await documentClient
        .put({
          TableName: process.env.USERS_TABLE || "summaraize-users-dev",
          Item: user,
        })
        .promise();
      console.log(`Inserted sample user: ${user.userId}`);
    } catch (error) {
      console.error(`Error inserting user ${user.userId}:`, error);
    }
  }

  // Insert sample papers
  for (const paper of samplePapers) {
    try {
      await documentClient
        .put({
          TableName: process.env.PAPERS_TABLE || "summaraize-papers-dev",
          Item: paper,
        })
        .promise();
      console.log(`Inserted sample paper: ${paper.paperId}`);
    } catch (error) {
      console.error(`Error inserting paper ${paper.paperId}:`, error);
    }
  }
};

// Main function
const setupLocalDB = async () => {
  try {
    await createTables();
    console.log("Tables created successfully!");

    await insertSampleData();
    console.log("Sample data inserted successfully!");
  } catch (error) {
    console.error("Error setting up local DynamoDB:", error);
  }
};

setupLocalDB();
