import React, { createContext, useState, useContext, useEffect } from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  getCurrentUser,
  isAuthenticated,
  refreshToken,
} from "../services/auth";

// 인증 컨텍스트 생성
const AuthContext = createContext(null);

// JWT 토큰 디코딩 함수
const decodeJWT = (token) => {
  try {
    if (!token) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));

    return JSON.parse(decoded);
  } catch (error) {
    console.error("Failed to decode token:", error);
    return null;
  }
};

// 토큰 만료 확인 함수
const isTokenExpired = (token) => {
  if (!token) return true;

  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;

  // exp는 초 단위, Date.now()는 밀리초 단위
  const currentTime = Math.floor(Date.now() / 1000);

  // 만료 10분 전부터 갱신 시도 (600초)
  return decoded.exp - currentTime < 600;
};

// 인증 제공자 컴포넌트
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // 토큰 상태 체크 및 갱신 (30초마다 실행)
  useEffect(() => {
    const checkTokenStatus = async () => {
      if (!isAuthenticated()) {
        setAuthenticated(false);
        setUser(null);
        return;
      }

      const token = localStorage.getItem("summaraize-token");

      if (isTokenExpired(token)) {
        console.log("Token expired or about to expire, attempting refresh");
        try {
          const response = await refreshToken();

          if (response.success) {
            console.log("Token refreshed successfully");
            setUser(response.user || getCurrentUser());
            setAuthenticated(true);
          } else {
            console.warn("Token refresh failed:", response.message);
            // 리프레시 토큰도 만료된 경우 로그아웃
            await handleLogout();
          }
        } catch (error) {
          console.error("Error refreshing token:", error);
          // 에러 발생 시 로그아웃
          await handleLogout();
        }
      }
    };

    // 초기 상태 체크
    const initializeAuth = () => {
      const isUserAuthenticated = isAuthenticated();
      setAuthenticated(isUserAuthenticated);

      if (isUserAuthenticated) {
        setUser(getCurrentUser());
      }

      setLoading(false);
    };

    initializeAuth();

    // 토큰 상태 주기적 체크
    const tokenCheckInterval = setInterval(checkTokenStatus, 30000);

    return () => {
      clearInterval(tokenCheckInterval);
    };
  }, []);

  // 로그인 함수
  const handleLogin = async (email, password) => {
    try {
      const response = await apiLogin(email, password);

      if (response.success) {
        setUser(response.user);
        setAuthenticated(true);
      }

      return response;
    } catch (error) {
      console.error("Login error in AuthContext:", error);
      throw error;
    }
  };

  // 로그아웃 함수
  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error("Logout error in AuthContext:", error);
    } finally {
      // 로컬 상태 초기화
      setUser(null);
      setAuthenticated(false);
    }
  };

  // 컨텍스트 값
  const value = {
    user,
    authenticated,
    loading,
    login: handleLogin,
    logout: handleLogout,
    refreshUserToken: refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 인증 컨텍스트 훅
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
