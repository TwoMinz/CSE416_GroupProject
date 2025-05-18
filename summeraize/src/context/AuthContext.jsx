// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from "react";
import {
  isAuthenticated,
  getCurrentUser,
  refreshToken,
  logout as logoutService,
} from "../services/auth";

// Create auth context
const AuthContext = createContext(null);

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if user is already authenticated
        const authStatus = isAuthenticated();
        setAuthenticated(authStatus);

        if (authStatus) {
          // Get current user from local storage
          const userData = getCurrentUser();
          setUser(userData);

          // Try to refresh the token silently
          try {
            await refreshToken();
          } catch (error) {
            console.warn(
              "Token refresh failed on init, user may need to login again",
              error
            );
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      const { login } = await import("../services/auth");
      const result = await login(email, password);

      if (result.success) {
        setAuthenticated(true);
        setUser(result.user);
      }

      return result;
    } catch (error) {
      console.error("Login error in context:", error);
      return { success: false, error: error.message };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await logoutService();
      setAuthenticated(false);
      setUser(null);
      return { success: true };
    } catch (error) {
      console.error("Logout error in context:", error);
      // Still clear auth state even if API call fails
      setAuthenticated(false);
      setUser(null);
      return { success: false, error: error.message };
    }
  };

  // Update user function - used after profile changes
  const updateUser = (userData) => {
    setUser(userData);

    // Also update in localStorage to ensure persistence
    localStorage.setItem("summaraize-user", JSON.stringify(userData));
  };

  // Context value
  const value = {
    authenticated,
    user,
    loading,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
