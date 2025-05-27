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
  try {
    console.log(`Changing username for user ${userId} to: ${newUsername}`);
    const token = getToken();

    const response = await apiRequest(
      "/api/auth/modify/username",
      "POST",
      {
        userId,
        newUserId: newUsername,
      },
      token
    );

    if (response.success && response.user) {
      // Update user in local storage
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      console.log("Username updated successfully:", response.user);
    }

    return response;
  } catch (error) {
    console.error("Error changing username:", error);
    throw error;
  }
};

const changePassword = async (userId, newPassword, currentPassword = null) => {
  try {
    console.log(`Changing password for user ${userId}`);
    const token = getToken();

    const payload = {
      userId,
      newPassword,
    };

    // Include current password if provided (required for non-social logins)
    if (currentPassword) {
      payload.currentPassword = currentPassword;
    }

    const response = await apiRequest(
      "/api/auth/modify/password",
      "POST",
      payload,
      token
    );

    if (response.success && response.user) {
      // Update user in local storage
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      console.log("Password updated successfully");
    }

    return response;
  } catch (error) {
    console.error("Error changing password:", error);
    throw error;
  }
};

const updateProfileImageUrl = async (userId, imageUrl) => {
  try {
    console.log(`Updating profile image URL for user ${userId}`);
    const token = getToken();

    const response = await apiRequest(
      "/api/auth/modify/profileImage",
      "POST",
      {
        userId,
        imageUrl,
      },
      token
    );

    if (response.success && response.user) {
      // Update user in local storage
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      console.log("Profile image URL updated successfully");
    }

    return response;
  } catch (error) {
    console.error("Error updating profile image URL:", error);
    throw error;
  }
};

const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "ml_default"); // 실제 preset으로 변경

  try {
    const response = await fetch(
      "https://api.cloudinary.com/v1_1/daqrxgtih/image/upload", // 실제 cloud name으로 변경
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};

// 수정된 uploadProfileImage 함수
const uploadProfileImage = async (file) => {
  try {
    const user = getCurrentUser();
    if (!user || !user.userId) {
      throw new Error("User not authenticated");
    }

    console.log(`Uploading profile image for user ${user.userId}`);

    // File type validation
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"];
    if (!validTypes.includes(file.type)) {
      throw new Error("Only JPG, PNG, and GIF images are allowed");
    }

    // File size validation (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("Image size should not exceed 5MB");
    }

    // Step 1: Upload to Cloudinary
    console.log("Uploading to Cloudinary...");
    const cloudinaryResult = await uploadToCloudinary(file);

    if (!cloudinaryResult || !cloudinaryResult.secure_url) {
      throw new Error("Failed to upload image to Cloudinary");
    }

    console.log("Cloudinary upload successful:", cloudinaryResult.secure_url);

    // Step 2: Update user profile URL in database
    console.log("Updating profile URL in database...");
    const response = await updateProfileImageUrl(
      user.userId,
      cloudinaryResult.secure_url
    );

    if (!response.success) {
      throw new Error(
        response.message || "Failed to update profile in database"
      );
    }

    console.log("Profile image updated successfully");
    return response;
  } catch (error) {
    console.error("Profile image upload error:", error);
    throw error;
  }
};

const changeLanguage = async (userId, languageCode) => {
  try {
    console.log(`Changing language for user ${userId} to: ${languageCode}`);
    const token = getToken();

    const response = await apiRequest(
      "/api/auth/modify/language",
      "POST",
      {
        userId,
        languageCode,
      },
      token
    );

    if (response.success && response.user) {
      // Update user in local storage
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      console.log("Language preference updated successfully:", response.user);
    }

    return response;
  } catch (error) {
    console.error("Error changing language preference:", error);
    throw error;
  }
};

const processOAuthRedirect = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const refreshToken = params.get("refreshToken");
  const userParam = params.get("user");

  console.log("Processing OAuth redirect:", {
    hasToken: !!token,
    hasRefreshToken: !!refreshToken,
    hasUser: !!userParam,
  });

  if (token && refreshToken) {
    try {
      // Store tokens in local storage
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      console.log("OAuth tokens stored successfully");

      // Parse and store user info if available
      if (userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          localStorage.setItem(USER_KEY, JSON.stringify(user));
          console.log("OAuth user data stored:", user);
        } catch (e) {
          console.error("Error parsing user data from URL:", e);
          // 사용자 데이터 파싱에 실패해도 토큰만으로 로그인 처리
          console.log("Proceeding with token-only authentication");
        }
      }

      // Remove tokens from URL (replace history)
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);

      return true;
    } catch (error) {
      console.error("Error processing OAuth redirect:", error);
      return false;
    }
  }

  return false;
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
  updateProfileImageUrl,
  uploadProfileImage,
  changeLanguage,
  processOAuthRedirect,
};
