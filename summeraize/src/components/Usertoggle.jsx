import React, { useState, useRef, useEffect } from 'react';
import testAvatar from '../assets/images/test-avatar.png';
import archiveIcon from '../assets/images/archive.png';
import settingIcon from '../assets/images/setting.png';
import logoutIcon from '../assets/images/logout.png';
import { useNavigate } from 'react-router-dom';

const UserToggle = ({ onArchiveClick, onSettingClick, onLogoutClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const navigate = useNavigate();
  const handleClickArchieve = () => {
    navigate('/Library');
  }

  // 드롭다운 표시 여부 토글
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // 외부 클릭시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 옵션 클릭 처리
  const handleOptionClick = (callback) => {
    if (callback) {
      callback();
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 사용자 아바타 버튼 */}
      <button 
        onClick={toggleDropdown}
        style={{ width: '3.5rem', height: '3.5rem'}}
        className="rounded-full overflow-hidden border-2 border-white focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all duration-300"
      >
        <img 
          src={testAvatar} 
          alt="User" 
          className="w-full h-full object-cover"
        />
      </button>

      {/* 드롭다운 메뉴 */}
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
                onClick={() => handleOptionClick(onSettingClick)}
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