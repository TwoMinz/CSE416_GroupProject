import React, { createContext, useState, useEffect, useContext } from "react";
import {
  getCurrentUser,
  getToken,
  login,
  logout,
  isAuthenticated,
} from "../services/auth";
import { closeConnection } from "../services/websocket";

// Create the auth context
const AuthContext = createContext();

// Context provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // Initialize auth state from localStorage on app load
  useEffect(() => {
    const initAuth = () => {
      try {
        if (isAuthenticated()) {
          setUser(getCurrentUser());
          setAuthenticated(true);
        }
      } catch (error) {
        console.error("Error initializing auth state:", error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Handle login
  const handleLogin = async (email, password) => {
    setLoading(true);
    try {
      const response = await login(email, password);
      setUser(response.user);
      setAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      // Close WebSocket connection on logout
      closeConnection();
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

  // Update user info in context when it changes
  const updateUser = (userData) => {
    setUser(userData);
  };

  // Provide the auth context to the app
  return (
    <AuthContext.Provider
      value={{
        user,
        authenticated,
        loading,
        login: handleLogin,
        logout: handleLogout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
