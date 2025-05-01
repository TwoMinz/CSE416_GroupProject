import React, { useState } from "react";
import PdfUploader from "../components/PdfUploader";
import Signin from "../components/Signin";
import UserToggle from "../components/UserToggle";
import { useAuth } from "../context/AuthContext";

const Home = () => {

  // Use the auth context instead of local state
  const { authenticated, logout } = useAuth();
  const [uploadStatus] = useState(null);


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

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between bg-gradient-to-b from-blue-100 to-blue-500 relative p-5">
      {/* Login button or user toggle component */}
      <div className="absolute top-5 right-5">
        {authenticated ? (
          <UserToggle
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
