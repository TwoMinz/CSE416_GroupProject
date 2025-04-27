import React, { useState, useEffect } from "react";
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
  const { user, authenticated } = useAuth();
  const navigate = useNavigate();

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
    setIsDragging(false);
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
      alert("Please upload only PDF files");
    }
  };

  // Handle the file upload process
  const handleFileUpload = async (file) => {
    if (!authenticated) {
      alert("Please log in to upload files");
      navigate("/login");
      return;
    }

    setIsUploading(true);
    setUploadStatus({ status: "starting", message: "Starting upload..." });

    try {
      const token = localStorage.getItem("summaraize-token");

      const result = await uploadPaperFile(
        file,
        token,
        user.userId,
        (status) => {
          setUploadStatus(status);
        }
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
      console.error("File upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBrowseClick = () => {
    document.getElementById("file-upload").click();
  };

  return (
    <div className="relative w-full max-w-lg">
      <div
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
        <div>
          {/* Upload Icon */}
          <div className="flex justify-center items-center mb-4 ">
            <img
              src={uploadIcon}
              alt="Upload"
              className="w-20 h-20 object-contain"
              draggable="false"
            />
          </div>
          <div className="transition-all duration-300 ease-in-out">
            {isDragging ? (
              <h1 className="text-3xl font-bold text-blue-600 mb-2 transition-all duration-300 transform scale-103">
                Drag Here!
              </h1>
            ) : isUploading ? (
              <>
                <h1 className="text-3xl font-bold text-blue-600 mb-2">
                  {uploadStatus?.status || "Uploading..."}
                </h1>
                <p className="font-semibold text-gray-800">
                  {uploadStatus?.message || "Please wait..."}
                </p>
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
                  Only pdf files are available
                </p>
              </>
            )}
          </div>

          <input
            type="file"
            id="file-upload"
            accept=".pdf"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isUploading}
          />
        </div>
      </div>

      {/* Upload status display */}
      {uploadStatus && uploadStatus.status !== "completed" && (
        <div className="absolute bottom-0 left-0 w-full transform translate-y-full mt-4">
          <div
            className={`p-3 rounded-lg shadow-md text-sm mt-2 ${
              uploadStatus.status === "error"
                ? "bg-red-100 text-red-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            <div className="font-bold capitalize">{uploadStatus.status}</div>
            <div>{uploadStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfUploader;
