import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Signin from "../components/Signin";
import UserToggle from "../components/UserToggle";
import { useAuth } from "../context/AuthContext";
import PdfUploader from "../components/PdfUploader"; // Use the enhanced version

const Home = () => {
  // Use the auth context
  const { authenticated, user, logout } = useAuth();
  const [uploadStatus, setUploadStatus] = useState(null);
  const [showTips, setShowTips] = useState(false);
  const navigate = useNavigate();

  // Check for pending uploads from sessions (for login redirects)
  useEffect(() => {
    if (authenticated && sessionStorage.getItem("pendingUpload")) {
      const pendingFile = sessionStorage.getItem("pendingUpload");
      setUploadStatus({
        status: "pending",
        message: `Ready to resume upload of "${pendingFile}". Please drag the file again.`,
      });
      sessionStorage.removeItem("pendingUpload");
    }
  }, [authenticated]);

  const handleHomeClick = () => {
    navigate("/");
  };

  const handleFileUpload = (files) => {
    console.log("Files received in Home component:", files);
    // File upload handling is now in the PdfUploader component
  };

  const handleLogoutClick = async () => {
    try {
      await logout();
      console.log("Logged out");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const toggleTips = () => {
    setShowTips(!showTips);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between bg-gradient-to-b from-blue-100 to-blue-500 relative p-5">
      {/* Header area with login button or user toggle */}
      <div className="w-full flex justify-between items-center">
        <div className="flex items-center">
          <h2
            onClick={handleHomeClick}
            className="text-3xl font-bold text-white cursor-pointer hover:text-blue-200 transition-colors ml-4"
          >
            SummarAIze
          </h2>
          {authenticated && (
            <span className="ml-4 text-white text-sm bg-blue-400 px-3 py-1 rounded-full">
              Welcome, {user?.username || "User"}
            </span>
          )}
        </div>

        <div>
          {authenticated ? (
            <UserToggle onLogoutClick={handleLogoutClick} />
          ) : (
            <Signin />
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex items-center justify-center w-full">
        <div className="flex flex-col items-center max-w-4xl w-full">
          {/* Welcome text for first-time visitors */}
          {!authenticated && (
            <div className="text-center mb-8 text-white">
              <h1 className="text-4xl font-bold mb-4">
                Smart Research Assistant
              </h1>
              <p className="text-xl mb-2">
                Upload your research papers and get instant summaries.
              </p>
              <p className="text-lg">
                Save time and gain insights faster with AI-powered analysis.
              </p>
            </div>
          )}

          {/* PDF uploader component */}
          <PdfUploader onFileUpload={handleFileUpload} />

          {/* Tips toggle button */}
          <button
            onClick={toggleTips}
            className="mt-8 text-white flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            {showTips ? "Hide Tips" : "Show Tips"}
          </button>

          {/* Tips content */}
          {showTips && (
            <div className="mt-4 bg-white bg-opacity-30 backdrop-blur-sm p-6 rounded-xl text-white max-w-2xl">
              <h3 className="font-bold text-xl mb-3">Tips for Best Results</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>Upload research papers in PDF format only</li>
                <li>Ensure PDFs are text-based, not scanned images</li>
                <li>
                  For best results, use papers with clear structure (abstract,
                  introduction, etc.)
                </li>
                <li>Files up to 20MB are supported</li>
                <li>
                  Processing usually takes 30-60 seconds depending on paper
                  length
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Upload status notification */}
      {uploadStatus && uploadStatus.status === "pending" && (
        <div className="fixed bottom-5 right-5 bg-white p-4 rounded-lg shadow-lg max-w-md">
          <h3 className="font-bold text-lg">Upload Pending</h3>
          <p>{uploadStatus.message}</p>
        </div>
      )}

      {/* Footer area */}
      <div className="w-full mt-auto pt-5 text-center text-white">
        <p className="text-sm opacity-80">
          © 2025 SummarAIze. AI-powered research assistant.
        </p>
      </div>
    </div>
  );
};

export default Home;
