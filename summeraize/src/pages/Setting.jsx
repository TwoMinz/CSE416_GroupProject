import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SimplePopup, { usePopup } from "../components/SimplePopup";
import {
  changeUsername,
  changePassword,
  uploadProfileImage,
  changeLanguage,
} from "../services/auth";

// Language options for display
const LANGUAGE_MAP = {
  1: "English",
  2: "Korean",
  3: "Spanish",
  4: "French",
};

const Setting = () => {
  const navigate = useNavigate();
  const { user, authenticated, updateUser, logout } = useAuth();
  const fileInputRef = useRef(null);

  // State variables
  const [nickname, setNickname] = useState("");
  const [language, setLanguage] = useState(1);
  const [email, setEmail] = useState("");
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Popup for notifications
  const { isOpen, popupContent, openPopup, closePopup } = usePopup();

  // Initialize state with user information
  useEffect(() => {
    if (authenticated && user) {
      console.log("User:", user);
      setNickname(user.username || "Nickname");
      setLanguage(user.transLang || 1);
      setEmail(user.email || "");
    } else {
      // Redirect if not authenticated
      navigate("/login");
    }
  }, [authenticated, user, navigate]);

  const handleBackClick = () => {
    navigate("/");
  };

  const handleNicknameClick = () => {
    setIsEditingNickname(true);
  };

  const handleNicknameChange = (e) => {
    setNickname(e.target.value);
  };

  // Save nickname when finished editing
  const handleNicknameBlur = async () => {
    setIsEditingNickname(false);

    // Only update if changed and valid
    if (
      user &&
      nickname &&
      nickname !== user.username &&
      nickname.trim().length > 0
    ) {
      try {
        const result = await changeUsername(user.userId, nickname);
        if (result.success) {
          openPopup("Success", "Username has been updated successfully!");
          // Update user context
          if (updateUser) {
            updateUser(result.user);
          }
        } else {
          openPopup("Error", result.message || "Failed to update username");
          // Revert to original username
          setNickname(user.username);
        }
      } catch (error) {
        console.error("Error updating username:", error);
        openPopup("Error", "An error occurred while updating your username");
        // Revert to original username
        setNickname(user.username);
      }
    } else if (nickname.trim().length === 0) {
      // Revert if empty
      setNickname(user.username);
      openPopup("Error", "Username cannot be empty");
    }
  };

  const handleNicknameKeyDown = (e) => {
    if (e.key === "Enter") {
      handleNicknameBlur();
    }
  };

  const handleLanguageChange = async (e) => {
    const newLangValue = parseInt(e.target.value);

    // If same language, no need to update
    if (newLangValue === language) {
      return;
    }

    setIsChangingLanguage(true);

    try {
      // Call the API to update the user's language preference
      const result = await changeLanguage(user.userId, newLangValue);

      if (result.success) {
        setLanguage(newLangValue);
        // Update user in context
        if (updateUser) {
          updateUser(result.user);
        }
        openPopup(
          "Language Changed",
          `Language has been changed to ${
            LANGUAGE_MAP[newLangValue] || newLangValue
          }. Newly summarized papers will use this language.`
        );
      } else {
        openPopup(
          "Error",
          result.message || "Failed to update language preference"
        );
        // Revert to original language
        setLanguage(user.transLang || 1);
      }
    } catch (error) {
      console.error("Error changing language:", error);
      openPopup(
        "Error",
        "An error occurred while updating your language preference"
      );
      // Revert to original language
      setLanguage(user.transLang || 1);
    } finally {
      setIsChangingLanguage(false);
    }
  };

  // Toggle password change form
  const handlePasswordClick = () => {
    setShowPasswordForm(!showPasswordForm);
    // Reset form if closing
    if (showPasswordForm) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    }
  };

  // Handle password change submission
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!currentPassword) {
      openPopup("Error", "Current password is required");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      openPopup("Error", "New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      openPopup("Error", "New password must be at least 6 characters long");
      return;
    }

    try {
      const result = await changePassword(
        user.userId,
        newPassword,
        currentPassword
      );
      if (result.success) {
        openPopup("Success", "Password has been updated successfully!");
        setShowPasswordForm(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        openPopup("Error", result.message || "Failed to update password");
      }
    } catch (error) {
      console.error("Error updating password:", error);
      openPopup("Error", "An error occurred while updating your password");
    }
  };

  // Handle profile picture button click
  const handlePictureButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleChoosePicture = async (e) => {
    const selectedFile = e.target.files[0];

    if (!selectedFile) return;

    // 파일 유형 검증
    const validTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(selectedFile.type)) {
      openPopup("Error", "Please select a PNG or JPG image.");
      return;
    }

    // 파일 크기 검증 (최대 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (selectedFile.size > maxSize) {
      openPopup("Error", "Image size should not exceed 2MB.");
      return;
    }

    try {
      setIsUploadingImage(true);
      setUploadProgress(20);

      // 서버 측에서 처리하는 새로운 함수 사용
      const result = await uploadProfileImage(selectedFile);
      setUploadProgress(100);

      if (result.success) {
        openPopup("Success", "Profile picture has been updated!");

        // 사용자 컨텍스트 업데이트
        if (updateUser) {
          updateUser(result.user);
        }
      } else {
        throw new Error(result.message || "Failed to update profile picture");
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      openPopup("Error", `Failed to upload profile picture: ${error.message}`);
    } finally {
      setIsUploadingImage(false);
      setUploadProgress(0);
      // 파일 인풋 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      openPopup("Error", "Failed to log out. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-100 to-blue-500">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".png,.jpg,.jpeg"
        onChange={handleChoosePicture}
        style={{ display: "none" }}
      />

      {/* Main Content */}
      <div className="flex-1 flex justify-center items-center p-4">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="p-8 flex flex-col items-center">
            {/* Profile Photo */}
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {user && user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: "center" }}
                  />
                ) : (
                  <span className="text-gray-500 font-medium">Edit Photo</span>
                )}

                {/* Upload progress overlay */}
                {isUploadingImage && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-white mt-2">{uploadProgress}%</div>
                  </div>
                )}
              </div>
              <button
                className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-2 shadow-md hover:bg-blue-600 transition-colors"
                onClick={handlePictureButtonClick}
                disabled={isUploadingImage}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            </div>

            {/* User Info */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold">
                Hi,{" "}
                {isEditingNickname ? (
                  <input
                    type="text"
                    value={nickname}
                    onChange={handleNicknameChange}
                    onBlur={handleNicknameBlur}
                    onKeyDown={handleNicknameKeyDown}
                    className="border-b border-blue-500 outline-none text-blue-500"
                    autoFocus
                  />
                ) : (
                  <span
                    className="text-blue-500 cursor-pointer"
                    onClick={handleNicknameClick}
                  >
                    {nickname}
                  </span>
                )}
                !
              </h2>
            </div>

            {/* Settings Fields */}
            <div className="w-full space-y-5">
              {/* Email Field */}
              <div className="flex items-center">
                <label className="font-semibold text-gray-700 text-lg w-1/3">
                  Email:
                </label>
                <div className="w-2/3">
                  <div className="border border-gray-200 rounded-xl py-3 px-4 text-gray-700 w-full">
                    {email}
                  </div>
                </div>
              </div>

              {/* Password Field */}
              <div className="flex items-center">
                <label className="font-semibold text-gray-700 text-lg w-1/3">
                  Password:
                </label>
                <div className="flex items-center w-2/3">
                  <div
                    className="border border-gray-200 rounded-xl py-3 px-4 text-gray-700 w-full cursor-pointer hover:border-blue-300 transition-colors"
                    onClick={handlePasswordClick}
                  >
                    ••••••••
                  </div>
                </div>
              </div>

              {/* Password change form */}
              {showPasswordForm && (
                <form
                  onSubmit={handlePasswordSubmit}
                  className="bg-gray-50 p-4 rounded-lg"
                >
                  <h3 className="font-semibold text-gray-700 mb-3">
                    Change Password
                  </h3>

                  <div className="mb-3">
                    <label className="block text-gray-600 mb-1 text-sm">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block text-gray-600 mb-1 text-sm">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block text-gray-600 mb-1 text-sm">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handlePasswordClick}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      Update Password
                    </button>
                  </div>
                </form>
              )}

              {/* Language Field */}
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-700 text-lg w-1/3">
                  Summarization Language:
                </label>
                <div className="w-2/5">
                  <div className="relative">
                    <select
                      value={language}
                      onChange={handleLanguageChange}
                      className={`${
                        isChangingLanguage ? "opacity-70 cursor-wait" : ""
                      } bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-xl w-full appearance-none cursor-pointer text-center pr-8 shadow-sm transition-colors font-medium`}
                      disabled={isChangingLanguage}
                    >
                      {Object.entries(LANGUAGE_MAP).map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white">
                      {isChangingLanguage ? (
                        <svg
                          className="animate-spin h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      ) : (
                        <svg
                          className="fill-current h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <div className="pt-4 flex justify-center">
                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white py-2 px-6 rounded-full transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 text-center">
        <h2
          onClick={handleBackClick}
          className="text-2xl font-bold text-white cursor-pointer hover:text-blue-200 transition-colors"
        >
          SummarAIze
        </h2>
      </div>

      {/* Popup for notifications */}
      <SimplePopup
        title={popupContent.title}
        content={popupContent.content}
        isOpen={isOpen}
        onClose={closePopup}
      />
    </div>
  );
};

export default Setting;
