import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import researchImage from "../assets/images/student-research.jpg";
import { useAuth } from "../context/AuthContext";
import GoogleLoginButton from "../components/GoogleLoginButton";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authenticated, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Check for OAuth redirect with token/code in URL
  useEffect(() => {
    // Process URL parameters for OAuth redirects
    const queryParams = new URLSearchParams(location.search);
    const token = queryParams.get("token");
    const refreshToken = queryParams.get("refreshToken");
    const userJson = params.get("user");
    const oauthError = queryParams.get("error");

    // Handle successful OAuth redirect with tokens
    if (token && refreshToken) {
      console.log("OAuth login successful, tokens received");
      // Store tokens in localStorage
      localStorage.setItem("summaraize-token", token);
      localStorage.setItem("summaraize-refresh-token", refreshToken);

      if (userJson) {
        try {
          const user = JSON.parse(decodeURIComponent(userJson));
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        } catch (e) {
          console.error("OAuth 사용자 데이터 파싱 오류", e);
        }
      }

      // URL 파라미터 제거 (깨끗한 URL로 상태 유지)
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);

      // Redirect to home
      navigate("/");
    }

    // Handle OAuth error
    if (oauthError) {
      setError(`Login error: ${oauthError}`);
      // Remove error from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check for messages from state (e.g., after signup)
    if (location.state?.message) {
      setMessage(location.state.message);
    }
  }, [location, navigate]);

  // Redirect if already authenticated
  useEffect(() => {
    console.log("Auth state in Login:", {
      user: useAuth.user,
    });

    if (authenticated === true && user) {
      console.log("User is authenticated, redirecting to home");
      navigate("/");
    }
  }, [authenticated, navigate]);

  const handleClickWebLogo = () => {
    navigate("/");
  };

  const handleClickSignUp = () => {
    navigate("/signup");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setIsLoading(true);

    try {
      // Call the login function from AuthContext
      const result = await login(email, password);

      if (result.success) {
        // Redirect to home page after successful login
        console.log("Login successful:", result);
        navigate("/");
      } else {
        setError(result.error || "Login failed. Please try again.");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-b from-blue-100 to-blue-500">
      {/* Left side - Login Form */}
      <div className="w-full md:w-2/5 p-8 md:p-12 flex flex-col justify-center">
        <div className="mb-4 text-left">
          <h2
            onClick={handleClickWebLogo}
            className="text-blue-600 text-xl font-bold cursor-pointer hover:text-blue-800 transition-colors inline-block"
            title="Back to Home"
          >
            SummarAIze
          </h2>
          <h1 className="text-gray-800 text-4xl font-bold">Log in</h1>
          <p className="text-gray-500 mt-3 font-semibold">
            Enter your email and password to log in
          </p>
        </div>

        {/* Success message */}
        {message && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {message}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Google Login Button */}
        <div className="mt-2 mb-4">
          <GoogleLoginButton />
        </div>

        {/* Divider */}
        <div className="relative flex py-3 items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-gray-600">or</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        <form onSubmit={handleSubmit} className="mt-2">
          <div className="mb-4">
            <input
              type="email"
              id="email"
              className="w-full px-4 py-2.5 rounded-full bg-white border border-gray-200 focus:outline-none focus:border-blue-500"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="mb-4">
            <input
              type="password"
              id="password"
              className="w-full px-4 py-2.5 rounded-full bg-white border border-gray-200 focus:outline-none focus:border-blue-500"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex-1 flex justify-end">
            <button
              type="submit"
              className={`w-1/2 bg-blue-600 text-white py-3 rounded-full font-medium hover:bg-blue-700 transition-colors ${
                isLoading ? "opacity-70 cursor-not-allowed" : ""
              }`}
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Log in"}
            </button>
          </div>
        </form>

        <div className="flex mt-3 text-left ml-2">
          {/* Left side - Help links */}
          <div className="flex-1 text-sm flex flex-col space-y-2">
            <a
              href="/"
              className="text-white font-semibold hover:text-blue-700 text-base"
            >
              Any help?
            </a>
            <a
              href="/"
              className="text-white font-semibold hover:text-blue-700 text-base"
            >
              Forgot PW
            </a>
            <a
              href="/"
              className="text-white font-semibold hover:text-blue-700 text-base"
            >
              Policy
            </a>
          </div>
          <div className="text-white self-center mr-2">
            <span>Don't have an account? </span>
            <button
              onClick={handleClickSignUp}
              className="text-white font-semibold hover:text-blue-200 underline"
            >
              Sign up
            </button>
          </div>
        </div>
      </div>

      {/* Right side - Image and Text */}
      <div className="hidden m-3 md:flex md:w-3/5 bg-blue-200 relative rounded-2xl shadow-lg overflow-hidden">
        {/* Overlay with semi-transparent gradient */}
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>

        {/* Background image */}
        <img
          src={researchImage}
          alt="Student researching"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Text overlay */}
        <div className="absolute bottom-12 left-12 right-12 text-white text-left">
          <h2
            className="text-4xl font-bold mb-4"
            style={{ textShadow: "0 2px 10px rgba(0, 0, 0, 0.8)" }}
          >
            Smart Summary, Smarter Research
          </h2>
          <p
            className="text-xl mb-1"
            style={{ textShadow: "0 2px 6px rgba(0, 0, 0, 0.7)" }}
          >
            Upload, Summarize, Understand.
          </p>
          <p
            className="text-xl mb-1"
            style={{ textShadow: "0 2px 6px rgba(0, 0, 0, 0.7)" }}
          >
            Let AI distill knowledge, so you can focus on insights.
          </p>
          <p
            className="text-xl"
            style={{ textShadow: "0 2px 6px rgba(0, 0, 0, 0.7)" }}
          >
            From paper to key points in seconds.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
