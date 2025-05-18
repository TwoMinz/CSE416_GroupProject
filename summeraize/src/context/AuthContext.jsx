import React, { createContext, useState, useContext, useEffect } from "react";
import {
  isAuthenticated,
  getCurrentUser,
  logout as authLogout,
} from "../services/auth";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication status on initial load
    checkAuthStatus();
  }, []);

  // Function to check authentication status
  const checkAuthStatus = () => {
    setLoading(true);
    const isAuth = isAuthenticated();
    setAuthenticated(isAuth);

    if (isAuth) {
      const currentUser = getCurrentUser();
      setUser(currentUser);
    } else {
      setUser(null);
    }
    setLoading(false);
  };

  // Function to handle login
  const login = async (email, password) => {
    try {
      const response = await import("../services/auth").then((module) =>
        module.login(email, password)
      );

      if (response.success) {
        setAuthenticated(true);
        setUser(response.user);
        return { success: true };
      } else {
        return { success: false, error: response.message };
      }
    } catch (error) {
      console.error("Login error in AuthContext:", error);
      return { success: false, error: error.message };
    }
  };

  // Function to handle logout
  const logout = async () => {
    try {
      await authLogout();
      setAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error("Logout error in AuthContext:", error);
      throw error;
    }
  };

  // Function to update user information
  const updateUser = (updatedUser) => {
    if (updatedUser) {
      setUser(updatedUser);
      // If user is updated, ensure authenticated state is true
      if (!authenticated) {
        setAuthenticated(true);
      }
      console.log("User updated in context:", updatedUser);
    }
  };

  const value = {
    authenticated,
    user,
    loading,
    login,
    logout,
    updateUser,
    refreshAuthStatus: checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
