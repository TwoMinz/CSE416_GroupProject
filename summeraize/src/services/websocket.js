// WebSocket service with token refresh support
import { getToken, refreshToken } from "./auth";
import config from "../config";

// Get WebSocket endpoint from config
const WS_ENDPOINT = config.websocketUrl;

let socket = null;
let reconnectTimer = null;
let listeners = {};
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// 토큰 디코딩 함수
const decodeJWT = (token) => {
  try {
    if (!token) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));

    return JSON.parse(decoded);
  } catch (error) {
    console.error("Failed to decode token:", error);
    return null;
  }
};

// 토큰 만료 확인 함수
const isTokenExpired = (token) => {
  if (!token) return true;

  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;

  // exp는 초 단위, Date.now()는 밀리초 단위
  const currentTime = Math.floor(Date.now() / 1000);

  return decoded.exp <= currentTime;
};

// 토큰 자동 갱신 처리
const refreshTokenIfNeeded = async () => {
  const token = getToken();

  if (!token) {
    return null;
  }

  if (isTokenExpired(token)) {
    console.log("WebSocket: Token expired, attempting to refresh");
    try {
      const response = await refreshToken();

      if (response.success) {
        console.log("WebSocket: Token refreshed successfully");
        return response.accessToken;
      } else {
        console.warn("WebSocket: Token refresh failed");
        // 갱신 실패 시 인증 필요 이벤트 발생
        window.dispatchEvent(new CustomEvent("auth:required"));
        return null;
      }
    } catch (error) {
      console.error("WebSocket: Error refreshing token:", error);
      return null;
    }
  }

  return token;
};

// Initialize WebSocket connection with token refresh
const initWebSocket = async () => {
  // 이미 연결되어 있거나 연결 중인 경우 처리
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
    // 토큰 갱신 필요 시 갱신
    const validToken = await refreshTokenIfNeeded();

    if (!validToken) {
      console.error("WebSocket: No valid authentication token available");
      isConnecting = false;
      return false;
    }

    console.log(
      `Connecting to WebSocket at ${WS_ENDPOINT} with token: ${validToken.substring(
        0,
        10
      )}...`
    );

    // Connect with token for authentication
    socket = new WebSocket(`${WS_ENDPOINT}?token=${validToken}`);

    socket.onopen = () => {
      console.log("WebSocket connected successfully");
      isConnecting = false;
      reconnectAttempts = 0; // 연결 성공 시 재시도 카운터 초기화

      // Clear any reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      // 모든 리스너에게 연결 성공 알림
      dispatchToListeners("CONNECTION_STATUS", {
        connected: true,
        message: "WebSocket connected",
      });
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

      // 모든 리스너에게 연결 끊김 알림
      dispatchToListeners("CONNECTION_STATUS", {
        connected: false,
        message: "WebSocket disconnected",
        code: event.code,
        reason: event.reason,
      });

      // 최대 재시도 횟수 확인
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;

        // 지수 백오프 적용 (1초, 2초, 4초, 8초, 16초)
        const backoffTime = Math.min(
          1000 * Math.pow(2, reconnectAttempts - 1),
          30000
        );

        console.log(
          `Attempting to reconnect WebSocket in ${
            backoffTime / 1000
          } seconds (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
        );

        // Attempt to reconnect after a delay with backoff
        reconnectTimer = setTimeout(() => {
          console.log("Attempting to reconnect WebSocket...");
          initWebSocket();
        }, backoffTime);
      } else {
        console.error("Maximum WebSocket reconnection attempts reached");

        // 인증 문제로 인한 연결 실패 시 토큰 갱신 시도
        if (event.code === 1001 || event.code === 1006 || event.code === 1011) {
          // 토큰 갱신 후 다시 연결 시도
          setTimeout(async () => {
            try {
              const refreshResult = await refreshToken();
              if (refreshResult.success) {
                console.log("Token refreshed, resetting reconnect attempts");
                reconnectAttempts = 0; // 토큰 갱신 성공 시 재시도 카운터 초기화
                initWebSocket();
              } else {
                console.error(
                  "Failed to refresh token after max reconnect attempts"
                );
                window.dispatchEvent(new CustomEvent("auth:required"));
              }
            } catch (error) {
              console.error(
                "Error refreshing token after WebSocket failures:",
                error
              );
              window.dispatchEvent(new CustomEvent("auth:required"));
            }
          }, 1000);
        }
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      isConnecting = false;

      // 모든 리스너에게 에러 알림
      dispatchToListeners("CONNECTION_ERROR", {
        message: "WebSocket connection error",
        error: error,
      });
    };

    return true;
  } catch (error) {
    console.error("WebSocket: Connection error", error);
    isConnecting = false;
    return false;
  }
};

// Helper function to dispatch message to all relevant listeners
const dispatchToListeners = (type, data) => {
  // Specific type listeners
  if (listeners[type]) {
    listeners[type].forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`WebSocket: Error in ${type} listener`, error);
      }
    });
  }

  // "all" listeners
  if (listeners["all"]) {
    listeners["all"].forEach((callback) => {
      try {
        callback({ type, ...data });
      } catch (error) {
        console.error(`WebSocket: Error in "all" listener`, error);
      }
    });
  }
};

// Handle incoming WebSocket messages
const handleMessage = (data) => {
  // Route messages to appropriate listeners based on type
  const messageType = data.type;
  dispatchToListeners(messageType, data);
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

// Send a message through the WebSocket with token refresh if needed
const sendMessage = async (action, data = {}) => {
  // 연결되어 있지 않은 경우 연결 시도
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    // 토큰 갱신 필요 시 갱신 후 연결
    const initSuccess = await initWebSocket();

    if (!initSuccess) {
      console.error("Failed to initialize WebSocket connection");
      return false;
    }

    // 연결 중인 경우 메시지 큐에 추가
    if (socket.readyState === WebSocket.CONNECTING) {
      return new Promise((resolve) => {
        socket.addEventListener(
          "open",
          () => {
            socket.send(
              JSON.stringify({
                action,
                ...data,
              })
            );
            resolve(true);
          },
          { once: true }
        );
      });
    }

    // 여전히 연결되지 않은 경우
    if (socket.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected after initialization attempt");
      return false;
    }
  }

  // 메시지 전송
  socket.send(
    JSON.stringify({
      action,
      ...data,
    })
  );

  return true;
};

// Request paper processing status with token validation
const requestPaperStatus = async (paperId) => {
  // 토큰 만료 확인 및 갱신
  await refreshTokenIfNeeded();

  return sendMessage("paperProcessStatus", { paperId });
};

// Force reconnect with fresh token
const reconnectWithNewToken = async () => {
  // 기존 연결 종료
  if (socket) {
    socket.close();
    socket = null;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  reconnectAttempts = 0;

  // 토큰 갱신 시도
  try {
    const refreshResult = await refreshToken();
    if (refreshResult.success) {
      console.log("Token refreshed, reconnecting WebSocket");
      return initWebSocket();
    } else {
      console.error("Failed to refresh token for WebSocket reconnection");
      return false;
    }
  } catch (error) {
    console.error("Error refreshing token for WebSocket reconnection:", error);
    return false;
  }
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
  reconnectAttempts = 0;
};

// Get connection status
const getConnectionStatus = () => {
  if (!socket) return "closed";

  switch (socket.readyState) {
    case WebSocket.CONNECTING:
      return "connecting";
    case WebSocket.OPEN:
      return "open";
    case WebSocket.CLOSING:
      return "closing";
    case WebSocket.CLOSED:
      return "closed";
    default:
      return "unknown";
  }
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
  reconnectWithNewToken,
  getConnectionStatus,
  simulatePaperStatusUpdate,
};
