import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Signup = () => {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [language, setLanguage] = useState('English');

  const handleBackClick = () => {
    navigate('/');
  };

  const handleNicknameChange = (e) => {
    setNickname(e.target.value);
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const handleConfirmPasswordChange = (e) => {
    setConfirmPassword(e.target.value);
  };

  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // 회원가입 로직 구현
    console.log('Signup data:', { nickname, email, password, language });
    // 성공 시 홈 또는 로그인 페이지로 이동
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-100 to-blue-500">
      {/* Header with Back Button */}
      <div className="p-5 flex items-center">
        <button 
          onClick={handleBackClick}
          className="text-blue-600 font-semibold flex items-center"
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
        <h1 className="text-2xl font-bold text-center flex-1">Sign Up</h1>
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
                <span className="text-gray-500 font-medium">Add Photo</span>
              </div>
              <button className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-2 shadow-md hover:bg-blue-600 transition-colors">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Sign Up Form */}
            <form onSubmit={handleSubmit} className="w-full space-y-6">
              {/* Nickname Field */}
              <div className="flex items-center">
                <label className="font-semibold text-gray-700 text-lg w-1/3">Nickname:</label>
                <div className="w-2/3">
                  <input 
                    type="text" 
                    value={nickname} 
                    onChange={handleNicknameChange}
                    className="border border-gray-200 rounded-xl py-3 px-4 text-gray-700 w-full focus:outline-none focus:border-blue-500"
                    placeholder="Enter nickname"
                    required
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="flex items-center">
                <label className="font-semibold text-gray-700 text-lg w-1/3">Email:</label>
                <div className="w-2/3">
                  <input 
                    type="email" 
                    value={email} 
                    onChange={handleEmailChange}
                    className="border border-gray-200 rounded-xl py-3 px-4 text-gray-700 w-full focus:outline-none focus:border-blue-500"
                    placeholder="Enter email"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="flex items-center">
                <label className="font-semibold text-gray-700 text-lg w-1/3">Password:</label>
                <div className="w-2/3">
                  <input 
                    type="password" 
                    value={password} 
                    onChange={handlePasswordChange}
                    className="border border-gray-200 rounded-xl py-3 px-4 text-gray-700 w-full focus:outline-none focus:border-blue-500"
                    placeholder="Enter password"
                    required
                  />
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="flex items-center">
                <label className="font-semibold text-gray-700 text-lg w-1/3">Confirm:</label>
                <div className="w-2/3">
                  <input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={handleConfirmPasswordChange}
                    className="border border-gray-200 rounded-xl py-3 px-4 text-gray-700 w-full focus:outline-none focus:border-blue-500"
                    placeholder="Confirm password"
                    required
                  />
                </div>
              </div>

              {/* Language Field */}
              <div className="flex items-center">
                <label className="font-semibold text-gray-700 text-lg w-1/3">Language:</label>
                <div className="w-2/3">
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

              {/* Submit Button */}
              <div className="pt-4 flex justify-center">
                <button 
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-8 rounded-xl shadow-md transition-colors w-2/3"
                >
                  Create Account
                </button>
              </div>
            </form>
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

export default Signup;