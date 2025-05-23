// Enhanced AuthContext.jsx with Google OAuth support
import React, { createContext, useContext, useState, useEffect } from "react";
import {
  login as authLogin,
  logout as authLogout,
  getCurrentUser,
  getToken,
  isAuthenticated,
  refreshToken as authRefreshToken,
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

  // 컴포넌트 마운트 시 인증 상태 확인
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // 인증 상태 확인 함수
  const checkAuthStatus = async () => {
    try {
      setLoading(true);

      // OAuth 리다이렉트 처리 먼저 확인
      const oauthProcessed = processOAuthRedirect();
      if (oauthProcessed) {
        console.log("OAuth redirect processed");
      }

      const token = getToken();
      const currentUser = getCurrentUser();

      console.log("Auth check:", {
        hasToken: !!token,
        hasUser: !!currentUser,
        isAuth: isAuthenticated(),
      });

      if (token && currentUser && isAuthenticated()) {
        // 토큰이 만료에 가까우면 갱신 시도
        try {
          await authRefreshToken();
          const refreshedUser = getCurrentUser();
          setUser(refreshedUser || currentUser);
          setAuthenticated(true);
          console.log("Auth status: authenticated with refreshed token");
        } catch (refreshError) {
          console.log("Token refresh failed, using existing auth");
          setUser(currentUser);
          setAuthenticated(true);
        }
      } else {
        console.log("Auth status: not authenticated");
        setUser(null);
        setAuthenticated(false);
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      setUser(null);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // 로그인 함수
  const login = async (email, password) => {
    try {
      setLoading(true);
      const result = await authLogin(email, password);

      if (result.success) {
        setUser(result.user);
        setAuthenticated(true);
        console.log("Login successful in context");
        return { success: true };
      } else {
        return { success: false, error: result.message };
      }
    } catch (error) {
      console.error("Login error in context:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃 함수
  const logout = async () => {
    try {
      await authLogout();
      setUser(null);
      setAuthenticated(false);
      console.log("Logout successful in context");
    } catch (error) {
      console.error("Logout error in context:", error);
      // 로그아웃은 실패해도 로컬 상태는 클리어
      setUser(null);
      setAuthenticated(false);
    }
  };

  // 사용자 정보 업데이트 함수
  const updateUser = (newUser) => {
    setUser(newUser);
    // localStorage도 업데이트
    localStorage.setItem("summaraize-user", JSON.stringify(newUser));
  };

  // Google OAuth나 다른 외부 인증을 위한 직접 인증 데이터 설정 함수
  const setAuthData = ({ user, authenticated, token }) => {
    console.log("Setting auth data directly:", {
      user: !!user,
      authenticated,
      token: !!token,
    });

    if (user) {
      setUser(user);
    }
    if (typeof authenticated === "boolean") {
      setAuthenticated(authenticated);
    }
    if (token) {
      localStorage.setItem("summaraize-token", token);
      if (user) {
        localStorage.setItem("summaraize-user", JSON.stringify(user));
      }
    }
  };

  // 토큰 갱신 함수
  const refreshToken = async () => {
    try {
      const result = await authRefreshToken();
      if (result.success && result.user) {
        setUser(result.user);
        setAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Token refresh failed:", error);
      setUser(null);
      setAuthenticated(false);
      return false;
    }
  };

  // 강제 인증 상태 새로고침 함수
  const forceRefreshAuth = () => {
    console.log("Force refreshing auth status");
    checkAuthStatus();
  };

  const value = {
    user,
    authenticated,
    loading,
    login,
    logout,
    updateUser,
    setAuthData,
    refreshToken,
    forceRefreshAuth,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
