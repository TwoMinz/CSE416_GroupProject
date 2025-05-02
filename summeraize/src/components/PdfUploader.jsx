import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import uploadIcon from "../assets/images/upload-icon.png";
import { uploadPaperFile } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  initWebSocket,
  addListener,
  simulatePaperStatusUpdate,
} from "../services/websocket";
import config from "../config";

const PdfUploader = ({ onFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadedPaperId, setUploadedPaperId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { user, authenticated } = useAuth();
  const navigate = useNavigate();
  const dropZoneRef = useRef(null);
  const fileInputRef = useRef(null);

  // Set up WebSocket listener for paper status updates
  useEffect(() => {
    if (authenticated && uploadedPaperId) {
      // Initialize WebSocket connection
      initWebSocket();

      // Listen for status updates for this specific paper
      const unsubscribe = addListener("PAPER_STATUS_UPDATE", (data) => {
        if (data.paperId === uploadedPaperId) {
          setUploadStatus({
            status: data.status,
            message: data.message || `Paper status: ${data.status}`,
          });

          // If processing is complete, navigate to the paper view
          if (data.status === "completed") {
            setTimeout(() => {
              navigate("/bookstand", { state: { paperId: uploadedPaperId } });
            }, 2000); // Give user time to see the completion message
          }
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [authenticated, uploadedPaperId, navigate]);

  // Function to handle drag enter event
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // Function to handle drag leave event
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if the drag is actually leaving the dropzone (not just entering a child element)
    const rect = dropZoneRef.current.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  // Function to handle drag over event
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  // Function to handle file drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  // Function to handle file input change
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      console.log("Files selected:", e.target.files);
    }
  };

  // Function to handle the files after drag and drop or file input change
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList);
    const validFiles = files.filter((file) => file.type === "application/pdf");

    if (validFiles.length > 0) {
      // Pass the valid files to the parent component
      if (onFileUpload) {
        onFileUpload(validFiles);
      }

      // Upload the first valid file
      await handleFileUpload(validFiles[0]);
    } else {
      // Show error for invalid file types
      setUploadStatus({
        status: "error",
        message: "Please upload only PDF files",
      });

      setTimeout(() => {
        setUploadStatus(null);
      }, 3000);
    }
  };

  // Handle the file upload process
  const handleFileUpload = async (file) => {
    if (!authenticated) {
      // Store the file in session storage to resume after login
      try {
        sessionStorage.setItem("pendingUpload", file.name);
      } catch (e) {
        console.error("Failed to store file info in session storage", e);
      }

      alert("Please log in to upload files");
      navigate("/login");
      return;
    }

    setIsUploading(true);
    setUploadStatus({ status: "starting", message: "Starting upload..." });
    setUploadProgress(0);

    try {
      const token = localStorage.getItem("summaraize-token");

      // Create a progress tracking function
      const updateProgress = (status) => {
        setUploadStatus(status);

        // Update progress bar based on status
        if (status.status === "requesting") {
          setUploadProgress(10);
        } else if (status.status === "uploading") {
          setUploadProgress(30);
        } else if (status.status === "confirming") {
          setUploadProgress(70);
        } else if (status.status === "processing") {
          setUploadProgress(100);
        }
      };

      const result = await uploadPaperFile(
        file,
        token,
        user.userId,
        updateProgress
      );

      if (result.success) {
        setUploadedPaperId(result.paperId);

        // For local development without actual websocket:
        if (config.isDevelopment) {
          simulatePaperStatusUpdate(
            result.paperId,
            "processing",
            "Processing PDF..."
          );

          setTimeout(() => {
            simulatePaperStatusUpdate(
              result.paperId,
              "analyzing",
              "Analyzing paper content..."
            );

            setTimeout(() => {
              simulatePaperStatusUpdate(
                result.paperId,
                "summarizing",
                "Generating summary..."
              );

              setTimeout(() => {
                simulatePaperStatusUpdate(
                  result.paperId,
                  "completed",
                  "Summary ready!"
                );
              }, 5000);
            }, 4000);
          }, 3000);
        }
      }
    } catch (error) {
      setUploadStatus({
        status: "error",
        message: `Upload failed: ${error.message}`,
      });
      setUploadProgress(0);
      console.error("File upload error:", error);

      // Reset upload state after an error
      setTimeout(() => {
        setIsUploading(false);
      }, 3000);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current.click();
  };

  // Reset file input when not uploading
  const handleCancelUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsUploading(false);
    setUploadStatus(null);
    setUploadProgress(0);
    setUploadedPaperId(null);
  };

  return (
    <div className="relative w-full max-w-lg">
      <div
        ref={dropZoneRef}
        className={`pt-4 w-full max-w-lg h-72 bg-white rounded-2xl shadow-xl flex items-center justify-center my-auto transition-all duration-300 border-2 border-dashed ${
          isDragging
            ? "border-blue-500 border-3 shadow-blue-200 scale-102 bg-blue-50"
            : "border-gray-300"
        } ${isUploading ? "opacity-60" : ""}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={isUploading ? null : handleBrowseClick}
      >
        <div className="w-full px-8">
          {/* Upload Icon */}
          <div className="flex justify-center items-center mb-4 ">
            <img
              src={uploadIcon}
              alt="Upload"
              className={`w-20 h-20 object-contain transition-all ${
                isUploading ? "opacity-50" : ""
              }`}
              draggable="false"
            />
          </div>
          <div className="transition-all duration-300 ease-in-out text-center">
            {isDragging ? (
              <h1 className="text-3xl font-bold text-blue-600 mb-2 transition-all duration-300 transform scale-103">
                Drop PDF Here!
              </h1>
            ) : isUploading ? (
              <>
                <h1 className="text-2xl font-bold text-blue-600 mb-2">
                  {uploadStatus?.status === "processing"
                    ? "Processing..."
                    : "Uploading..."}
                </h1>
                <p className="font-semibold text-gray-800 mb-3">
                  {uploadStatus?.message || "Please wait..."}
                </p>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                  <div
                    className="bg-blue-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>

                {/* Cancel button (only during upload, not processing) */}
                {uploadStatus?.status !== "processing" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelUpload();
                    }}
                    className="text-blue-500 text-sm hover:text-blue-700 mt-2"
                  >
                    Cancel
                  </button>
                )}
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-black-1000 mb-2">
                  Drag & Drop
                </h1>
                <p className="font-semibold text-gray-1000">
                  your file here or browse to upload
                </p>
                <p className="text-gray-500 text-sm mb-5">
                  Only PDF files are available
                </p>
              </>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isUploading}
          />
        </div>
      </div>

      {/* Upload status display */}
      {uploadStatus && uploadStatus.status === "error" && (
        <div className="absolute bottom-0 left-0 w-full transform translate-y-full mt-4">
          <div className="p-3 rounded-lg shadow-md text-sm mt-2 bg-red-100 text-red-800">
            <div className="font-bold capitalize">{uploadStatus.status}</div>
            <div>{uploadStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfUploader;
