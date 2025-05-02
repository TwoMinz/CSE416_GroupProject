import React, { useState } from 'react';
import PropTypes from 'prop-types';

// SimplePopup 컴포넌트
const SimplePopup = ({ 
  title, 
  content, 
  isOpen, 
  onClose, 
  buttonText = "I read" 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-xl overflow-hidden w-full max-w-md mx-4">
        {/* Header with title and icon */}
        <div className="flex items-center p-4 border-b border-gray-200">
          <div className="mr-2 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-800">{title}</h2>
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="text-gray-700">{content}</div>
        </div>

        {/* Action button */}
        <div className="flex p-4 justify-center">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-8 rounded-md transition-colors"
            onClick={onClose}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

SimplePopup.propTypes = {
  title: PropTypes.string.isRequired,
  content: PropTypes.node.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  buttonText: PropTypes.string
};

// usePopup 커스텀 훅
export const usePopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupContent, setPopupContent] = useState({
    title: '',
    content: ''
  });

  /**
   * 팝업을 열고 내용을 설정하는 함수
   * @param {string} title - 팝업 제목
   * @param {React.ReactNode|string} content - 팝업 내용 (텍스트 또는 JSX)
   */
  const openPopup = (title, content) => {
    setPopupContent({
      title,
      content
    });
    setIsOpen(true);
  };

  /**
   * 팝업을 닫는 함수
   */
  const closePopup = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    popupContent,
    openPopup,
    closePopup
  };
};

export default SimplePopup;