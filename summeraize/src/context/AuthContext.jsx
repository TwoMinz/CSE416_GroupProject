import React, { createContext, useState, useContext, useEffect } from "react";
import {
  login as authLogin,
  logout as authLogout,
  refreshToken,
  getToken,
  getCurrentUser,
  isAuthenticated,
} from "../services/auth";

// Create the AuthContext
const AuthContext = createContext();

// AuthProvider component to wrap the application
export const AuthProvider = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check authentication status on initial load and token changes
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if there's a token and user in localStorage
        const isUserAuthenticated = isAuthenticated;
        if (isUserAuthenticated) {
          const currentUser = getCurrentUser();
          setUser(currentUser);
          setAuthenticated(true);
        } else {
          // If token exists but is expired, try to refresh it
          const token = getToken();
          if (token) {
            try {
              const result = await refreshToken();
              if (result.success) {
                setUser(result.user);
                setAuthenticated(true);
              } else {
                // Clear state if refresh fails
                setUser(null);
                setAuthenticated(false);
              }
            } catch (error) {
              console.error("Auth refresh error:", error);
              setUser(null);
              setAuthenticated(false);
            }
          } else {
            // No token found, user is not authenticated
            setUser(null);
            setAuthenticated(false);
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setUser(null);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for storage events (for multi-tab support)
    const handleStorageChange = (e) => {
      if (e.key === "summaraize-token" || e.key === "summaraize-user") {
        checkAuth();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Listen for auth:required events from the API service
    const handleAuthRequired = () => {
      setAuthenticated(false);
      setUser(null);
    };

    window.addEventListener("auth:required", handleAuthRequired);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("auth:required", handleAuthRequired);
    };
  }, []);

  // Login function
  const login = async (email, password) => {
    setLoading(true);
    try {
      const result = await authLogin(email, password);

      if (result.success) {
        setUser(result.user);
        setAuthenticated(true);
        return { success: true };
      } else {
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
    setLoading(true);
    try {
      await authLogout();
      setUser(null);
      setAuthenticated(false);
      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Update user function - useful after profile changes
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  // Create auth context value
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

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
