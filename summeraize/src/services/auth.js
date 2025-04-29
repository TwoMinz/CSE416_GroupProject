// Authentication service for SummarAIze application
import { apiRequest } from "./api";

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
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (!refreshToken) {
      throw new Error("No refresh token found");
    }

    const response = await apiRequest("/api/auth/refresh", "POST", {
      refreshToken,
    });

    if (response.success) {
      localStorage.setItem(TOKEN_KEY, response.accessToken);

      // Update user if returned
      if (response.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      }
    }

    return response;
  } catch (error) {
    console.error("Token Refresh Error:", error);
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
