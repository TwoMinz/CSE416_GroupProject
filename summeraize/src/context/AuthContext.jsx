import React, { createContext, useState, useContext, useEffect } from "react";
import {
  login as authLogin,
  logout as authLogout,
  refreshToken,
  getCurrentUser,
  isAuthenticated,
} from "../services/auth";
import { closeConnection } from "../services/websocket";

// Create context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (isAuthenticated()) {
          const currentUser = getCurrentUser();
          setUser(currentUser);
          setAuthenticated(true);

          // Optionally refresh the token
          try {
            await refreshToken();
          } catch (refreshError) {
            console.warn(
              "Token refresh failed, user may need to login again soon",
              refreshError
            );
            // Continue with current token
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setError(error.message);
        setAuthenticated(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login function
  const login = async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authLogin(email, password);

      if (response.success) {
        setUser(response.user);
        setAuthenticated(true);
        return { success: true };
      } else {
        setError(response.message || "Login failed");
        return { success: false, error: response.message };
      }
    } catch (error) {
      console.error("Login error:", error);
      setError(error.message || "Login failed");
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setLoading(true);
    setError(null);

    try {
      await authLogout();

      // Close WebSocket connection
      closeConnection();

      setAuthenticated(false);
      setUser(null);
      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      setError(error.message || "Logout failed");

      // Still clear user state even if API call fails
      setAuthenticated(false);
      setUser(null);

      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Update user function (for profile changes)
  const updateUser = (userData) => {
    setUser((prevUser) => ({
      ...prevUser,
      ...userData,
    }));
  };

  // Context value
  const value = {
    authenticated,
    user,
    loading,
    error,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
