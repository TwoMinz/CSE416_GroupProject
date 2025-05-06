// Authentication service for SummarAIze application
import { apiRequest } from "./api";
import config from "../config";
// Local storage keys
const TOKEN_KEY = "summaraize-token";
const REFRESH_TOKEN_KEY = "summaraize-refresh-token";
const USER_KEY = "summaraize-user";

// Function to handle user signup
// In src/services/auth.js - enhance the signup function
const signup = async (email, password, username) => {
  try {
    console.log("Signup request details:", { email, username }); // Log request details
    const response = await apiRequest("/api/auth/signup", "POST", {
      email,
      password,
      username,
    });

    return response;
  } catch (error) {
    // Enhanced error logging
    console.error("Signup Error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Check if it's a network error
    if (
      error.name === "TypeError" &&
      error.message.includes("Failed to fetch")
    ) {
      console.error("Network error - API server might be down or unreachable");
    }

    throw error;
  }
};

// Function to handle user login
const login = async (email, password) => {
  try {
    console.log("Logging in user:", email);
    const response = await apiRequest("/api/auth/login", "POST", {
      email,
      password,
    });

    if (response.success) {
      // Store tokens and user info in local storage
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      console.log("Login successful");
    }

    return response;
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
};

// Function to handle user logout
const logout = async () => {
  try {
    const token = getToken();
    const user = getCurrentUser();

    if (token && user) {
      // Call logout API
      await apiRequest("/api/auth/logout", "POST", { user }, token);
    }

    // Clear local storage
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    return { success: true, message: "Logged out successfully" };
  } catch (error) {
    console.error("Logout Error:", error);
    // Still clear storage even if API call fails
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    throw error;
  }
};

// Function to refresh the access token
const refreshToken = async () => {
  try {
    console.log("Starting token refresh process");
    const refreshTokenValue = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (!refreshTokenValue) {
      console.error("No refresh token found in local storage");
      throw new Error("No refresh token found");
    }

    console.log("Making direct fetch to refresh token endpoint");
    const response = await fetch(`${config.apiBaseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    });

    console.log(
      "Refresh API raw response:",
      response.status,
      response.statusText
    );

    // 응답이 JSON이 아닐 경우를 대비한 처리
    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.error("Failed to parse refresh token response as JSON:", e);
      const text = await response.text();
      console.log("Response as text:", text);
      throw new Error("Invalid JSON response from server");
    }

    console.log("Refresh token response data:", data);

    if (data.success) {
      console.log("Token refresh successful, updating local storage");
      localStorage.setItem(TOKEN_KEY, data.accessToken);

      // Update user if returned
      if (data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }

      return data;
    } else {
      console.error("Token refresh failed:", data.message);
      throw new Error(data.message || "Token refresh failed");
    }
  } catch (error) {
    console.error("Token Refresh Error:", error);

    // Clear tokens if refresh fails
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);

    throw error;
  }
};
// Function to get the current token
const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

// Function to get the current user
const getCurrentUser = () => {
  const userJson = localStorage.getItem(USER_KEY);
  return userJson ? JSON.parse(userJson) : null;
};

// Function to check if user is authenticated
const isAuthenticated = () => {
  return !!getToken() && !!getCurrentUser();
};

// User profile update functions
const changeUsername = async (userId, newUsername) => {
  const token = getToken();
  return apiRequest(
    "/api/auth/modify/username",
    "POST",
    {
      userId,
      newUserId: newUsername,
    },
    token
  );
};

const changePassword = async (userId, newPassword) => {
  const token = getToken();
  return apiRequest(
    "/api/auth/modify/password",
    "POST",
    {
      userId,
      newPassword,
    },
    token
  );
};

const changeProfileImage = async (userId, fileKey) => {
  const token = getToken();
  return apiRequest(
    "/api/auth/modify/profileImage",
    "POST",
    {
      userId,
      fileKey,
    },
    token
  );
};

export {
  signup,
  login,
  logout,
  refreshToken,
  getToken,
  getCurrentUser,
  isAuthenticated,
  changeUsername,
  changePassword,
  changeProfileImage,
};
