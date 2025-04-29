// WebSocket service for real-time updates
import { getToken } from "./auth";
import config from "../config";

// Get WebSocket endpoint from config
const WS_ENDPOINT = config.websocketUrl;

let socket = null;
let reconnectTimer = null;
let listeners = {};
let isConnecting = false;

// Initialize WebSocket connection
const initWebSocket = () => {
  const token = getToken();

  if (!token) {
    console.error("WebSocket: No authentication token available");
    return false;
  }

  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return true; // Already connected or connecting
  }

  if (isConnecting) {
    return true; // Connection is in progress
  }

  isConnecting = true;

  try {
    console.log(`Connecting to WebSocket at ${WS_ENDPOINT}`);

    // Connect with token for authentication
    socket = new WebSocket(`${WS_ENDPOINT}?token=${token}`);

    socket.onopen = () => {
      console.log("WebSocket connected successfully");
      isConnecting = false;

      // Clear any reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);
        handleMessage(data);
      } catch (error) {
        console.error("WebSocket: Error parsing message", error);
      }
    };

    socket.onclose = (event) => {
      console.log(`WebSocket disconnected: ${event.code} ${event.reason}`);
      socket = null;
      isConnecting = false;

      // Attempt to reconnect after a delay (5 seconds)
      reconnectTimer = setTimeout(() => {
        console.log("Attempting to reconnect WebSocket...");
        initWebSocket();
      }, 5000);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      isConnecting = false;
    };

    return true;
  } catch (error) {
    console.error("WebSocket: Connection error", error);
    isConnecting = false;
    return false;
  }
};

// Handle incoming WebSocket messages
const handleMessage = (data) => {
  // Route messages to appropriate listeners based on type
  const messageType = data.type;

  if (messageType && listeners[messageType]) {
    listeners[messageType].forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`WebSocket: Error in ${messageType} listener`, error);
      }
    });
  }

  // Also trigger 'all' listeners for any message
  if (listeners["all"]) {
    listeners["all"].forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("WebSocket: Error in all-messages listener", error);
      }
    });
  }
};

// Add event listener for specific message types
const addListener = (type, callback) => {
  if (!listeners[type]) {
    listeners[type] = [];
  }

  listeners[type].push(callback);

  // Initialize connection if not already connected
  if (!socket) {
    initWebSocket();
  }

  // Return a function to remove this listener
  return () => removeListener(type, callback);
};

// Remove a specific listener
const removeListener = (type, callback) => {
  if (listeners[type]) {
    listeners[type] = listeners[type].filter((cb) => cb !== callback);

    // Clean up empty listener arrays
    if (listeners[type].length === 0) {
      delete listeners[type];
    }
  }
};

// Send a message through the WebSocket
const sendMessage = (action, data = {}) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    if (!initWebSocket()) {
      return false;
    }

    // If we just initiated a connection, queue the message to send when connected
    socket.addEventListener(
      "open",
      () => {
        socket.send(
          JSON.stringify({
            action,
            ...data,
          })
        );
      },
      { once: true }
    );

    return true;
  }

  socket.send(
    JSON.stringify({
      action,
      ...data,
    })
  );

  return true;
};

// Request paper processing status
const requestPaperStatus = (paperId) => {
  return sendMessage("paperProcessStatus", { paperId });
};

// Close the WebSocket connection
const closeConnection = () => {
  if (socket) {
    socket.close();
    socket = null;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  listeners = {};
};

// A utility function for development to simulate WebSocket messages
// This can be useful when testing the front-end without a working WebSocket connection
const simulatePaperStatusUpdate = (paperId, status, message) => {
  if (config.isDevelopment) {
    setTimeout(() => {
      handleMessage({
        type: "PAPER_STATUS_UPDATE",
        paperId,
        status,
        message,
      });
    }, 1000);
  }
};

export {
  initWebSocket,
  addListener,
  removeListener,
  sendMessage,
  requestPaperStatus,
  closeConnection,
  simulatePaperStatusUpdate,
};
