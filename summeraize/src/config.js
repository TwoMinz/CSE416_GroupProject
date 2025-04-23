// Application configuration

const config = {
  // Local development environment
  development: {
    apiBaseUrl: "http://localhost:3000/dev",
    websocketUrl: "ws://localhost:3001",
    mockAuth: true, // Set to true to use mock authentication in development
    mockWebSocket: true, // Set to true to use mock WebSocket in development
    logApiCalls: true, // Log API calls to console
  },

  // Production environment
  production: {
    apiBaseUrl: "https://api.summaraize.com",
    websocketUrl: "wss://ws.summaraize.com",
    mockAuth: false,
    mockWebSocket: false,
    logApiCalls: false,
  },

  // Testing environment
  test: {
    apiBaseUrl: "http://localhost:3000/dev",
    websocketUrl: "ws://localhost:3001",
    mockAuth: true,
    mockWebSocket: true,
    logApiCalls: false,
  },
};

// Use environment from NODE_ENV, default to development
const env = process.env.NODE_ENV || "development";

// Export the configuration for the current environment
export default config[env];
