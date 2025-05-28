// Base API configuration and utility functions
import config from "../config";
import { refreshToken, getToken, getCurrentUser } from "./auth";

// Get API base URL from config
const API_BASE_URL = config.apiBaseUrl;

// Default headers for API requests
const getHeaders = (token = null) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
};

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

const isTokenExpired = (token) => {
  if (!token) return true;

  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;

  // exp는 초 단위, Date.now()는 밀리초 단위
  const currentTime = Math.floor(Date.now() / 1000);

  return decoded.exp <= currentTime;
};

// 토큰 자동 갱신 처리
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// 자동 갱신 함수
const handleTokenRefresh = async () => {
  try {
    if (isRefreshing) {
      // 다른 요청이 이미 갱신 중이면 대기
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      });
    }

    isRefreshing = true;

    const result = await refreshToken();

    if (result.success) {
      isRefreshing = false;
      processQueue(null, result.accessToken);
      return result.accessToken;
    } else {
      isRefreshing = false;
      processQueue(new Error("Token refresh failed"));
      throw new Error("Token refresh failed");
    }
  } catch (error) {
    isRefreshing = false;
    processQueue(error);
    throw error;
  }
};

// 수정된 apiRequest 함수
const apiRequest = async (endpoint, method, data = null, token = null) => {
  try {
    // 자동으로 현재 토큰 사용
    let currentToken = token || getToken();

    // 토큰이 만료되었거나 만료 임박한 경우 갱신 시도
    if (currentToken && isTokenExpired(currentToken)) {
      console.log("Token expired, attempting to refresh before API request");
      try {
        currentToken = await handleTokenRefresh();
      } catch (refreshError) {
        console.error("Failed to refresh token:", refreshError);
        // 로그인 페이지로 리다이렉트하거나 다른 에러 처리
        window.dispatchEvent(new CustomEvent("auth:required"));
        throw new Error("Authentication required");
      }
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: getHeaders(currentToken),
    };

    if (data && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    // 응답을 처리하기 전에 응답 상태 확인
    if (!response.ok) {
      // 401 오류인 경우 (인증 오류)
      if (response.status === 401) {
        // 응답을 클론하여 여러 번 읽을 수 있도록 함
        const responseClone = response.clone();
        let responseData;

        try {
          responseData = await responseClone.json();
        } catch (jsonError) {
          console.error("Error parsing 401 response:", jsonError);
          throw new Error("Authentication error - invalid response format");
        }

        // 토큰 관련 에러 메시지 확인
        if (
          responseData.message?.includes("token") ||
          responseData.message?.includes("Token") ||
          responseData.message?.includes("auth")
        ) {
          console.log("Received 401, attempting to refresh token");

          try {
            // 토큰 갱신 시도
            currentToken = await handleTokenRefresh();

            // 새 토큰으로 요청 재시도
            const retryOptions = {
              ...options,
              headers: getHeaders(currentToken),
            };

            const retryResponse = await fetch(url, retryOptions);

            if (!retryResponse.ok) {
              const retryData = await retryResponse.json();
              throw new Error(
                retryData.message || "API request failed after token refresh"
              );
            }

            // 성공한 재시도 응답 반환
            return await retryResponse.json();
          } catch (refreshError) {
            console.error("Token refresh failed:", refreshError);
            // 로그인 페이지로 리다이렉트하거나 다른 에러 처리
            window.dispatchEvent(new CustomEvent("auth:required"));
            throw new Error("Authentication required");
          }
        }

        // 토큰 관련 오류가 아닌 401 오류인 경우
        throw new Error(responseData.message || "Authentication failed");
      } else {
        // 401이 아닌 다른 HTTP 오류인 경우
        const errorData = await response.json();
        throw new Error(
          errorData.message ||
            `API request failed with status ${response.status}`
        );
      }
    }

    // 성공 응답 파싱 및 반환
    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

// Paper upload API functions
const requestFileUpload = async (fileName, fileType, fileSize, token) => {
  return apiRequest(
    "/api/upload/request",
    "POST",
    {
      fileName,
      fileType,
      fileSize,
    },
    token
  );
};

const confirmUpload = async (
  paperId,
  fileKey,
  uploadSuccess,
  fileName,
  token
) => {
  return apiRequest(
    "/api/upload/confirm",
    "POST",
    {
      paperId,
      fileKey,
      uploadSuccess,
      fileName,
    },
    token
  );
};

// Direct upload to S3 with presigned URL
const uploadToS3 = async (file, uploadUrl, formFields) => {
  try {
    console.log("Uploading to S3 with:", {
      url: uploadUrl,
      fields: formFields,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    const formData = new FormData();

    Object.entries(formFields).forEach(([key, value]) => {
      formData.append(key, value);
    });

    formData.append("file", file);

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
      credentials: "omit",
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error("S3 Upload failed:", {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText,
      });
      throw new Error("S3 upload failed: " + response.statusText);
    }

    return true;
  } catch (error) {
    console.error("S3 Upload Error:", error);
    throw error;
  }
};

const loadLibrary = async (
  userId,
  token,
  limit = 10,
  sortBy = "uploadDate",
  order = "desc",
  lastEvaluatedKey = null // 새로 추가된 파라미터
) => {
  return apiRequest(
    "/api/library/load",
    "POST",
    {
      userId,
      limit,
      sortBy,
      order,
      lastEvaluatedKey, // 페이지네이션을 위한 키
    },
    token
  );
};

const getPaperDetail = async (paperId, token) => {
  return apiRequest(`/api/papers/${paperId}/detail`, "GET", null, token);
};

const getContentUrl = async (paperId, token) => {
  try {
    const response = await apiRequest(
      `/api/papers/${paperId}/contentUrl`,
      "GET",
      null,
      token
    );

    // 백엔드에서 pdfUrl과 summaryUrl을 반환하도록 수정됨
    return {
      pdfUrl: response.pdfUrl,
      summaryUrl: response.summaryUrl,
      expiresIn: response.expiresIn,
      success: response.success,
    };
  } catch (error) {
    console.error(`Error getting content URLs for paper ${paperId}:`, error);
    throw error;
  }
};

const searchPaper = async (userId, searchInput, token) => {
  return apiRequest(
    "/api/papers/search",
    "POST",
    {
      userId,
      searchInput,
    },
    token
  );
};

window.addEventListener("auth:required", () => {
  // 사용자에게 알림 표시
  console.log("Authentication required. Redirecting to login...");

  // 현재 URL 저장
  const currentPath = window.location.pathname;
  localStorage.setItem("auth_redirect", currentPath);

  // 로그인 페이지로 리다이렉트
  window.location.href = "/login";
});

// Handle paper upload process from start to finish
const uploadPaperFile = async (file, token, userId, onProgress) => {
  try {
    // Step 1: Request upload URL
    onProgress &&
      onProgress({ status: "requesting", message: "Requesting upload URL..." });

    console.log(
      "\nfile name: " + file.name,
      "\nfile type: " + file.type,
      "\nfile size: " + file.size,
      "\nfile token: " + token
    );

    const uploadRequest = await requestFileUpload(
      file.name,
      file.type,
      file.size,
      token
    );

    if (!uploadRequest.success) {
      throw new Error(uploadRequest.message || "Failed to get upload URL");
    }

    // Step 2: Upload to S3
    onProgress &&
      onProgress({ status: "uploading", message: "Uploading file..." });
    await uploadToS3(
      file,
      uploadRequest.directUploadConfig.url,
      uploadRequest.directUploadConfig.fields
    );

    // Step 3: Confirm upload success
    onProgress &&
      onProgress({ status: "confirming", message: "Confirming upload..." });
    await confirmUpload(
      uploadRequest.paperId,
      uploadRequest.fileKey,
      true, // uploadSuccess
      file.name,
      token
    );

    onProgress &&
      onProgress({
        status: "processing",
        message: "File uploaded successfully. Processing started...",
        paperId: uploadRequest.paperId,
      });

    return {
      success: true,
      paperId: uploadRequest.paperId,
      message: "Upload process completed",
    };
  } catch (error) {
    onProgress && onProgress({ status: "error", message: error.message });
    console.error("Upload Process Error:", error);
    throw error;
  }
};

const requestProfileImageUpload = async (
  fileName,
  fileType,
  fileSize,
  token
) => {
  return apiRequest(
    "/api/profile/upload",
    "POST",
    {
      userId: getCurrentUser().userId,
      fileName,
      fileType,
      fileSize,
    },
    token
  );
};

// 프로필 이미지 업로드 확인
const confirmProfileImageUpload = async (fileKey, uploadSuccess, token) => {
  return apiRequest(
    "/api/profile/confirm",
    "POST",
    {
      userId: getCurrentUser().userId,
      fileKey,
      uploadSuccess,
    },
    token
  );
};

export {
  apiRequest,
  requestFileUpload,
  confirmUpload,
  uploadToS3,
  loadLibrary,
  getPaperDetail,
  getContentUrl,
  searchPaper,
  uploadPaperFile,
  requestProfileImageUpload,
  confirmProfileImageUpload,
};
