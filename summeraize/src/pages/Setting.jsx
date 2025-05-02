import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Setting = () => {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('Nickname');
  const [language, setLanguage] = useState('Japanese');
  const [email] = useState('summarAIze@gmail.com');
  const [isEditingNickname, setIsEditingNickname] = useState(false);

  const handleBackClick = () => {
    navigate('/');
  };

  const handleNicknameClick = () => {
    setIsEditingNickname(true);
  };

  const handleNicknameChange = (e) => {
    setNickname(e.target.value);
  };

  const handleNicknameBlur = () => {
    setIsEditingNickname(false);
  };

  const handleNicknameKeyDown = (e) => {
    if (e.key === 'Enter') {
      setIsEditingNickname(false);
    }
  };

  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-100 to-blue-500">
      {/* Header with Back Button */}
      <div className="p-5 flex items-center">
        <button 
          onClick={handleBackClick}
          className="text-white font-semibold flex items-center"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 mr-1" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="w-20"></div> {/* Spacer for centering the title */}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex justify-center items-center p-4">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="p-8 flex flex-col items-center">
            {/* Profile Photo */}
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center">
                {/* Placeholder for profile image */}
                <span className="text-gray-500 font-medium">Edit Photo</span>
              </div>
              <button className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-2 shadow-md hover:bg-blue-600 transition-colors">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>

            {/* User Info */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold">
                Hi, {isEditingNickname ? (
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
                )}!
              </h2>
            </div>

            {/* Settings Fields - Adjusted layout with wider fields and better spacing */}
            <div className="w-full space-y-5">
              
              {/* Email Field */}
              <div className="flex items-center">
                <label className="font-semibold text-gray-700 text-lg w-1/3">Email:</label>
                <div className="w-2/3">
                  <div className="border border-gray-200 rounded-xl py-3 px-4 text-gray-700 w-full">
                    {email}
                  </div>
                </div>
              </div>

              {/* Password Field */}
              <div className="flex items-center">
                <label className="font-semibold text-gray-700 text-lg w-1/3">Password:</label>
                <div className="flex items-center w-2/3">
                  <div className="border border-gray-200 rounded-xl py-3 px-4 text-gray-700 w-full">
                    ••••••••
                  </div>
                </div>
              </div>

              {/* Language Field */}
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-700 text-lg w-1/3">Language:</label>
                <div className="w-2/5">
                  <div className="relative">
                    <select 
                      value={language}
                      onChange={handleLanguageChange}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-xl w-full appearance-none cursor-pointer text-center pr-8 shadow-sm transition-colors font-medium"
                    >
                      <option value="Korean">Korean</option>
                      <option value="English">English</option>
                      <option value="Japanese">Japanese</option>
                      <option value="Chinese">Chinese</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 text-center">
        <h2 className="text-2xl font-bold text-white">SummarAIze</h2>
      </div>
    </div>
  );
};

export default Setting;