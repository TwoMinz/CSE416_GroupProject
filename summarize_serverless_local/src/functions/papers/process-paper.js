// Send WebSocket message about paper processing status
const sendStatusUpdate = async (userId, paperId, status, message) => {
  try {
    // Get DynamoDB client
    const documentClient = getDynamoDBClient();

    // Get user's active connections
    const connectionsResult = await documentClient
      .query({
        TableName: process.env.CONNECTIONS_TABLE,
        IndexName: "UserIdIndex",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
      .promise();

    if (!connectionsResult.Items || connectionsResult.Items.length === 0) {
      console.log(`[PROCESS-PAPER] No active connections for user ${userId}`);
      return true;
    }

    // Get WebSocket client
    const websocketAPI = getWebSocketClient();

    // Send message to all connections
    for (const connection of connectionsResult.Items) {
      try {
        // Use the connectionId from the item (not the id which is numeric)
        const connectionId = connection.connectionId;

        if (!connectionId) {
          console.warn(
            `[PROCESS-PAPER] Connection without connectionId found: ${JSON.stringify(
              connection
            )}`
          );
          continue;
        }

        console.log(
          `[PROCESS-PAPER] Sending status update to connection: ${connectionId}`
        );

        await websocketAPI
          .postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify({
              type: "PAPER_STATUS_UPDATE",
              paperId,
              status,
              message,
            }),
          })
          .promise();
      } catch (wsError) {
        if (wsError.statusCode === 410) {
          // Stale connection, remove it
          console.log(
            `[PROCESS-PAPER] Removing stale connection: ${
              connection.id || connection.connectionId
            }`
          );

          try {
            // Delete using the numeric id as the key
            await documentClient
              .delete({
                TableName: process.env.CONNECTIONS_TABLE,
                Key: { id: connection.id },
              })
              .promise();
          } catch (deleteError) {
            console.error(
              `[PROCESS-PAPER] Error deleting stale connection:`,
              deleteError
            );
          }
        } else {
          console.error("[PROCESS-PAPER] WebSocket error:", wsError);
        }
      }
    }

    return true;
  } catch (error) {
    console.error(
      `[PROCESS-PAPER] Error sending WebSocket status update:`,
      error
    );
    return false;
  }
};
