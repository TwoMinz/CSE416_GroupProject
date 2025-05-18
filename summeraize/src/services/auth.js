// Authentication service for SummarAIze application
import {
  apiRequest,
  confirmProfileImageUpload,
  uploadToS3,
  requestProfileImageUpload,
} from "./api";
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

const changeProfileImage = async (userId, fileKey) => {
  try {
    console.log(
      `Updating profile image for user ${userId} with file key: ${fileKey}`
    );
    const token = getToken();

    const response = await apiRequest(
      "/api/auth/modify/profileImage",
      "POST",
      {
        userId,
        fileKey,
      },
      token
    );

    if (response.success && response.user) {
      // Update user in local storage
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      console.log("Profile image updated successfully:", response.user);
    }

    return response;
  } catch (error) {
    console.error("Error changing profile image:", error);
    throw error;
  }
};

const uploadProfileImage = async (file) => {
  try {
    const user = getCurrentUser();
    if (!user || !user.userId) {
      throw new Error("User not authenticated");
    }

    console.log(`Uploading profile image for user ${user.userId}`);
    const token = getToken();

    if (!token) {
      throw new Error("Authorization token is required");
    }

    // 파일 유형 검증
    const validTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      throw new Error("Only JPG and PNG images are allowed");
    }

    // 1단계: 업로드 URL 요청
    const uploadRequestUrl = `${config.apiBaseUrl}/api/profile/upload`;
    console.log("Requesting upload URL from:", uploadRequestUrl);

    const uploadRequestResponse = await fetch(uploadRequestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: user.userId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }),
    });

    if (!uploadRequestResponse.ok) {
      const errorText = await uploadRequestResponse.text();
      console.error("Upload request failed:", errorText);
      throw new Error(
        `Failed to request upload URL: ${uploadRequestResponse.statusText}`
      );
    }

    const uploadRequest = await uploadRequestResponse.json();

    if (!uploadRequest.success) {
      throw new Error(uploadRequest.message || "Failed to get upload URL");
    }

    // 2단계: S3에 업로드
    console.log("Uploading file to S3");
    const formData = new FormData();

    // formData에 필드 추가
    Object.entries(uploadRequest.directUploadConfig.fields).forEach(
      ([key, value]) => {
        formData.append(key, value);
      }
    );

    // 파일 추가
    formData.append("file", file);

    // S3에 업로드
    const s3UploadResponse = await fetch(uploadRequest.directUploadConfig.url, {
      method: "POST",
      body: formData,
      credentials: "omit", // CORS 처리
    });

    if (!s3UploadResponse.ok) {
      const errorText = await s3UploadResponse.text();
      console.error("S3 upload failed:", errorText);
      throw new Error(`S3 upload failed: ${s3UploadResponse.statusText}`);
    }

    // 3단계: 업로드 확인
    const confirmUrl = `${config.apiBaseUrl}/api/profile/confirm`;
    console.log("Confirming upload at:", confirmUrl);

    const confirmResponse = await fetch(confirmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: user.userId,
        fileKey: uploadRequest.fileKey,
        uploadSuccess: true,
      }),
    });

    if (!confirmResponse.ok) {
      const errorText = await confirmResponse.text();
      console.error("Confirm upload failed:", errorText);
      throw new Error(
        `Failed to confirm upload: ${confirmResponse.statusText}`
      );
    }

    const confirmResult = await confirmResponse.json();

    if (!confirmResult.success) {
      throw new Error(confirmResult.message || "Failed to confirm upload");
    }

    // 사용자 로컬 스토리지 업데이트
    if (confirmResult.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(confirmResult.user));
    }

    console.log("Profile image uploaded successfully");
    return confirmResult;
  } catch (error) {
    console.error("Profile image upload error:", error);
    throw error;
  }
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
  uploadProfileImage,
};
