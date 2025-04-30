// Base API configuration and utility functions
import config from "../config";

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

// Generic API request function
const apiRequest = async (endpoint, method, data = null, token = null) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: getHeaders(token),
    };

    if (data && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.message || "API request failed");
    }

    return responseData;
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

// Library and paper functions
const loadLibrary = async (
  userId,
  token,
  page = 1,
  limit = 10,
  sortBy = "uploadDate",
  order = "desc"
) => {
  return apiRequest(
    "/api/library/load",
    "POST",
    {
      userId,
      page,
      limit,
      sortBy,
      order,
    },
    token
  );
};

const getPaperDetail = async (paperId, token) => {
  return apiRequest(`/api/papers/${paperId}/detail`, "GET", null, token);
};

const getContentUrl = async (paperId, token) => {
  return apiRequest(`/api/papers/${paperId}/contentUrl`, "GET", null, token);
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

// Handle paper upload process from start to finish
const uploadPaperFile = async (file, token, userId, onProgress) => {
  try {
    // Step 1: Request upload URL
    onProgress &&
      onProgress({ status: "requesting", message: "Requesting upload URL..." });
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
};
