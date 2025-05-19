import React, { createContext, useState, useContext, useEffect } from "react";
import {
  login as authLogin,
  logout as authLogout,
  getCurrentUser,
  getToken,
  refreshToken,
  changeUsername as updateUsername,
  changePassword as updatePassword,
  changeProfileImage as updateProfileImage,
  changeLanguage as updateLanguage,
} from "../services/auth";

// Create the auth context
const AuthContext = createContext(null);

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if token exists
        const token = getToken();
        if (token) {
          // Get current user
          const currentUser = getCurrentUser();

          if (currentUser) {
            setUser(currentUser);
            setAuthenticated(true);
          } else {
            // Try to refresh token if user info missing
            try {
              const result = await refreshToken();
              if (result.success) {
                setUser(result.user);
                setAuthenticated(true);
              }
            } catch (refreshError) {
              // Reset auth state on refresh error
              setUser(null);
              setAuthenticated(false);
            }
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
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
      const result = await authLogin(email, password);

      if (result.success) {
        setUser(result.user);
        setAuthenticated(true);
      }

      return result;
    } catch (error) {
      console.error("Login error in context:", error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authLogout();
      setUser(null);
      setAuthenticated(false);
      return { success: true };
    } catch (error) {
      console.error("Logout error in context:", error);
      throw error;
    }
  };

  // Update user function
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  // Utility function to check if the user is authenticated
  const isAuthenticated = () => {
    return authenticated;
  };

  // Provide auth context
  return (
    <AuthContext.Provider
      value={{
        authenticated,
        user,
        loading,
        login,
        logout,
        updateUser,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};

export default AuthContext;
