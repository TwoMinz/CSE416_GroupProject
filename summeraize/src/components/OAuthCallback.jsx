// OAuthCallback.jsx - OAuth 처리 전용 컴포넌트
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthData, forceRefreshAuth } = useAuth();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing authentication...");

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        setStatus("processing");
        setMessage("Processing authentication...");

        const queryParams = new URLSearchParams(location.search);
        const token = queryParams.get("token");
        const refreshToken = queryParams.get("refreshToken");
        const userParam = queryParams.get("user");
        const error = queryParams.get("error");

        console.log("OAuth callback received:", {
          hasToken: !!token,
          hasRefreshToken: !!refreshToken,
          hasUser: !!userParam,
          hasError: !!error,
        });

        // Handle OAuth error
        if (error) {
          console.error("OAuth error:", error);
          setStatus("error");
          setMessage(`Authentication failed: ${error}`);

          setTimeout(() => {
            navigate("/login", {
              state: { error: `Authentication failed: ${error}` },
              replace: true,
            });
          }, 2000);
          return;
        }

        // Handle missing tokens
        if (!token || !refreshToken) {
          console.error("Missing tokens in OAuth callback");
          setStatus("error");
          setMessage("Invalid authentication response - missing tokens");

          setTimeout(() => {
            navigate("/login", {
              state: { error: "Invalid authentication response" },
              replace: true,
            });
          }, 2000);
          return;
        }

        // Process successful OAuth
        setMessage("Saving authentication data...");

        // Store tokens
        localStorage.setItem("summaraize-token", token);
        localStorage.setItem("summaraize-refresh-token", refreshToken);
        console.log("Tokens stored successfully");

        // Parse and store user data
        let userData = null;
        if (userParam) {
          try {
            userData = JSON.parse(decodeURIComponent(userParam));
            localStorage.setItem("summaraize-user", JSON.stringify(userData));
            console.log("User data stored:", userData);
          } catch (parseError) {
            console.error("Error parsing user data:", parseError);
            // Continue without user data - AuthContext will handle it
          }
        }

        setMessage("Completing login...");

        // Update auth context
        if (setAuthData && userData) {
          setAuthData({
            user: userData,
            authenticated: true,
            token: token,
          });
        } else if (forceRefreshAuth) {
          // If no user data or setAuthData, force AuthContext to refresh
          forceRefreshAuth();
        }

        setStatus("success");
        setMessage("Login successful! Redirecting...");

        // Small delay to show success message, then redirect
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 1000);
      } catch (error) {
        console.error("Error processing OAuth callback:", error);
        setStatus("error");
        setMessage("An unexpected error occurred during authentication");

        setTimeout(() => {
          navigate("/login", {
            state: { error: "Failed to process authentication" },
            replace: true,
          });
        }, 2000);
      }
    };

    // Only run once when component mounts
    handleOAuthCallback();
  }, []); // Empty dependency array to run only once

  const getStatusColor = () => {
    switch (status) {
      case "processing":
        return "text-blue-300";
      case "success":
        return "text-green-300";
      case "error":
        return "text-red-300";
      default:
        return "text-white";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "processing":
        return (
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
        );
      case "success":
        return (
          <div className="mx-auto mb-4 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      case "error":
        return (
          <div className="mx-auto mb-4 w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-500">
      <div className="text-center text-white max-w-md px-6">
        {getStatusIcon()}
        <h2 className="text-2xl font-bold mb-2">SummarAIze</h2>
        <p className={`text-lg ${getStatusColor()}`}>{message}</p>

        {status === "error" && (
          <div className="mt-4">
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="bg-white text-blue-600 px-6 py-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
