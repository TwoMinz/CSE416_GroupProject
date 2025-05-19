import React, { useState, useRef, useEffect } from "react";
import defaultAvatar from "../assets/images/default-avatar.png"; // Replace with your default icon path
import archiveIcon from "../assets/images/archive.png";
import settingIcon from "../assets/images/setting.png";
import logoutIcon from "../assets/images/logout.png";
import { useNavigate } from "react-router-dom";

const UserToggle = ({ onArchiveClick, onSettingClick, onLogoutClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User avatar button - using default icon instead of user profile picture */}
      <button
        onClick={toggleDropdown}
        style={{ width: "3.5rem", height: "3.5rem" }}
        className="rounded-full overflow-hidden border-2 border-white focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all duration-300"
      >
        <img
          src={defaultAvatar}
          alt="User"
          className="w-full h-full object-cover"
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-0 w-48 bg-white rounded-lg shadow-xl py-1 z-10 border border-gray-200">
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
