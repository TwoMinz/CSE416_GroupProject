import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import researchImage from "../assets/images/student-research.jpg";
import { signup } from "../services/auth";
import GoogleLoginButton from "../components/GoogleLogin";

const Signup = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleClickWebLogo = () => {
    navigate("/");
  };

  const handleGoToLogin = () => {
    navigate("/login");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    console.log("Starting sign up process...");

    // Validation
    if (!email || !password || !username) {
      setError("All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      // Call the signup function from auth service
      const result = await signup(email, password, username);

      if (result && result.success) {
        // Redirect to login page after successful signup
        navigate("/login", {
          state: { message: "Account created successfully! Please log in." },
        });
      } else {
        setError(result?.message || "Signup failed. Please try again.");
      }
    } catch (error) {
      console.error("Signup error:", error);
      setError(
        error?.message || "An error occurred during signup. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-b from-blue-100 to-blue-500">
      {/* Left side - Signup Form */}
      <div className="w-full md:w-2/5 p-8 md:p-12 flex flex-col justify-center">
        <div className="mb-4 text-left">
          <h2
            onClick={handleClickWebLogo}
            className="text-blue-600 text-xl font-bold cursor-pointer hover:text-blue-800 transition-colors inline-block"
            title="Back to Home"
          >
            SummarAIze
          </h2>
          <h1 className="text-gray-800 text-4xl font-bold">Sign up</h1>
          <p className="text-gray-500 mt-3 font-semibold">
            Create your account to get started
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

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
              type="text"
              id="username"
              className="w-full px-4 py-2.5 rounded-full bg-white border border-gray-200 focus:outline-none focus:border-blue-500"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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

          <div className="mb-4">
            <input
              type="password"
              id="confirmPassword"
              className="w-full px-4 py-2.5 rounded-full bg-white border border-gray-200 focus:outline-none focus:border-blue-500"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              {isLoading ? "Creating Account..." : "Sign up"}
            </button>
          </div>
        </form>

        <div className="flex justify-between mt-6">
          <div className="text-white">
            Already have an account?{" "}
            <button
              onClick={handleGoToLogin}
              className="text-white font-semibold hover:text-blue-200 underline"
            >
              Log in
            </button>
          </div>
        </div>

        <div className="h-full">
            <GoogleLoginButton/>
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
            Join the Research Revolution
          </h2>
          <p
            className="text-xl mb-1"
            style={{ textShadow: "0 2px 6px rgba(0, 0, 0, 0.7)" }}
          >
            Create your account today.
          </p>
          <p
            className="text-xl mb-1"
            style={{ textShadow: "0 2px 6px rgba(0, 0, 0, 0.7)" }}
          >
            Gain insights faster than ever before.
          </p>
          <p
            className="text-xl"
            style={{ textShadow: "0 2px 6px rgba(0, 0, 0, 0.7)" }}
          >
            Revolutionize your research workflow.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
