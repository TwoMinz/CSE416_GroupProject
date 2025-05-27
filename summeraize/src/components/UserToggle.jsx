import React, { useState, useRef, useEffect } from "react";
import defaultAvatar from "../assets/images/default-avatar.png";
import archiveIcon from "../assets/images/archive.png";
import settingIcon from "../assets/images/setting.png";
import logoutIcon from "../assets/images/logout.png";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // AuthContext 추가

const UserToggle = ({ onArchiveClick, onSettingClick, onLogoutClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const dropdownRef = useRef(null);
  const { user } = useAuth(); // 유저 정보 가져오기

  const navigate = useNavigate();

  const handleClickArchieve = () => {
    navigate("/Library");
  };

  const handleClickSetting = () => {
    navigate("/setting");
  };

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle option clicks
  const handleOptionClick = (callback) => {
    if (callback) {
      callback();
    }
    setIsOpen(false);
  };

  // 이미지 로드 에러 처리
  const handleImageError = () => {
    setImageError(true);
  };

  // 표시할 이미지 결정
  const getProfileImage = () => {
    if (imageError || !user?.profilePicture) {
      return defaultAvatar;
    }
    return user.profilePicture;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User avatar button - 실제 프로필 사진 사용 */}
      <button
        onClick={toggleDropdown}
        style={{ width: "3.5rem", height: "3.5rem" }}
        className="rounded-full overflow-hidden border-2 border-white focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all duration-300 hover:scale-105"
        title={user?.username ? `${user.username}'s profile` : "User profile"}
      >
        <img
          src={getProfileImage()}
          alt="User Profile"
          className="w-full h-full object-cover"
          onError={handleImageError}
          style={{ objectPosition: "center" }}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-1 z-10 border border-gray-200">
          {/* 유저 정보 표시 */}
          {user && (
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <img
                  src={getProfileImage()}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover"
                  onError={handleImageError}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.username}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          <ul>
            <li>
              <button
                onClick={() => handleOptionClick(handleClickArchieve)}
                className="w-full text-left px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center transition-colors duration-150"
              >
                <img src={archiveIcon} alt="Archive" className="w-5 h-5 mr-2" />
                Archive
              </button>
            </li>
            <li>
              <button
                onClick={() => handleOptionClick(handleClickSetting)}
                className="w-full text-left px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center transition-colors duration-150"
              >
                <img src={settingIcon} alt="Setting" className="w-5 h-5 mr-2" />
                Setting
              </button>
            </li>
            <li className="border-t border-gray-100">
              <button
                onClick={() => handleOptionClick(onLogoutClick)}
                className="w-full text-left px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center transition-colors duration-150"
              >
                <img src={logoutIcon} alt="Logout" className="w-5 h-5 mr-2" />
                Log out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default UserToggle;
