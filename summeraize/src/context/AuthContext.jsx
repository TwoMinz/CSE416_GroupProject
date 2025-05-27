// AuthContext.jsx - WebSocket 의존성 제거 버전
import React, { createContext, useContext, useState, useEffect } from "react";
import {
  login as authLogin,
  logout as authLogout,
  isAuthenticated,
  getCurrentUser,
  processOAuthRedirect,
} from "../services/auth";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log("Initializing authentication...");

        // Check for OAuth redirect first
        const oauthProcessed = processOAuthRedirect();
        if (oauthProcessed) {
          console.log("OAuth redirect processed successfully");
        }

        // Check authentication status
        if (isAuthenticated()) {
          const currentUser = getCurrentUser();
          console.log("User is authenticated:", currentUser);
          setUser(currentUser);
          setAuthenticated(true);
        } else {
          console.log("User is not authenticated");
          setUser(null);
          setAuthenticated(false);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        setUser(null);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      console.log("Attempting login for:", email);
      setLoading(true);

      const result = await authLogin(email, password);

      if (result.success) {
        console.log("Login successful, updating auth state");
        setUser(result.user);
        setAuthenticated(true);
        return { success: true };
      } else {
        console.log("Login failed:", result.message);
        return { success: false, error: result.message };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      console.log("Attempting logout");
      setLoading(true);

      await authLogout();

      console.log("Logout successful, clearing auth state");
      setUser(null);
      setAuthenticated(false);

      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout API fails, clear local state
      setUser(null);
      setAuthenticated(false);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Update user information
  const updateUser = (newUserData) => {
    console.log("Updating user data:", newUserData);
    setUser(newUserData);

    // Update localStorage as well
    try {
      localStorage.setItem("summaraize-user", JSON.stringify(newUserData));
    } catch (error) {
      console.error("Error updating user in localStorage:", error);
    }
  };

  // Force refresh auth state (for OAuth callback)
  const forceRefreshAuth = () => {
    console.log("Force refreshing auth state");
    const currentUser = getCurrentUser();
    const isAuth = isAuthenticated();

    setUser(currentUser);
    setAuthenticated(isAuth);

    console.log("Auth state refreshed:", {
      user: currentUser,
      authenticated: isAuth,
    });
  };

  // Set auth data directly (for OAuth callback)
  const setAuthData = ({
    user: userData,
    authenticated: authStatus,
    token,
  }) => {
    console.log("Setting auth data directly:", { userData, authStatus });
    setUser(userData);
    setAuthenticated(authStatus);
  };

  // Listen for auth:required events
  useEffect(() => {
    const handleAuthRequired = () => {
      console.log(
        "Authentication required event received, clearing auth state"
      );
      setUser(null);
      setAuthenticated(false);
    };

    window.addEventListener("auth:required", handleAuthRequired);

    return () => {
      window.removeEventListener("auth:required", handleAuthRequired);
    };
  }, []);

  const value = {
    user,
    authenticated,
    loading,
    login,
    logout,
    updateUser,
    forceRefreshAuth,
    setAuthData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
