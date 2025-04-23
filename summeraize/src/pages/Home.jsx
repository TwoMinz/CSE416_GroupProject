import React, { useState, useEffect } from "react";
import PdfUploader from "../components/PdfUploader";
import Signin from "../components/Signin";
import UserToggle from "../components/UserToggle";
import DebugToggle from "../components/DebugToggle";
import { useAuth } from "../context/AuthContext";
import {
  initWebSocket,
  addListener,
  removeListener,
} from "../services/websocket";

const Home = () => {
  // Use the auth context instead of local state
  const { authenticated, user, logout } = useAuth();
  const [uploadStatus, setUploadStatus] = useState(null);

  // Initialize WebSocket connection when authenticated
  useEffect(() => {
    if (authenticated) {
      // Initialize WebSocket connection
      initWebSocket();

      // Add listeners for paper status updates
      const unsubscribe = addListener("PAPER_STATUS_UPDATE", (data) => {
        console.log("Paper status update:", data);
        setUploadStatus(data);
      });

      return () => {
        // Remove listeners when component unmounts
        unsubscribe();
      };
    }
  }, [authenticated]);

  const handleFileUpload = (files) => {
    console.log("Files received in Home component:", files);
    // File upload handling is now in the PdfUploader component
  };

  // UserToggle option handlers
  const handleArchiveClick = () => {
    console.log("Archive clicked");
    // Navigate to library would happen in the UserToggle component
  };

  const handleSettingClick = () => {
    console.log("Setting clicked");
  };

  const handleLogoutClick = async () => {
    try {
      await logout();
      console.log("Logged out");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between bg-gradient-to-b from-blue-100 to-blue-500 relative p-5">
      {/* Debug toggle - for development only */}
      {process.env.NODE_ENV === "development" && (
        <DebugToggle isLoggedIn={authenticated} onToggleLogin={() => {}} />
      )}

      {/* Login button or user toggle component */}
      <div className="absolute top-5 right-5">
        {authenticated ? (
          <UserToggle
            onArchiveClick={handleArchiveClick}
            onSettingClick={handleSettingClick}
            onLogoutClick={handleLogoutClick}
          />
        ) : (
          <Signin />
        )}
      </div>

      {/* PDF uploader component */}
      <div className="flex-grow flex items-center justify-center w-full">
        <PdfUploader onFileUpload={handleFileUpload} />
      </div>

      {/* Upload status notification */}
      {uploadStatus && (
        <div className="fixed bottom-5 right-5 bg-white p-4 rounded-lg shadow-lg max-w-md">
          <h3 className="font-bold text-lg">{uploadStatus.status}</h3>
          <p>{uploadStatus.message}</p>
        </div>
      )}

      {/* App name */}
      <div className="mt-auto pt-5">
        <h2 className="text-2xl font-bold text-white drop-shadow-sm">
          SummarAIze
        </h2>
      </div>
    </div>
  );
};

export default Home;
