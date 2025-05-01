import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LANGUAGE_MAP = {
  1: 'kimchi',
  2: 'ramen',
  3: 'hodu gwaja',
  4: 'spaghetti'
};

const Setting = () => {
  const navigate = useNavigate();
  const { user, authenticated } = useAuth();
  const fileInputRef = useRef(null); // 파일 입력을 위한 ref 추가

  // State 변수들을 실제 사용자 정보로 초기화
  const [nickname, setNickname] = useState('');
  const [language, setLanguage] = useState('');
  const [email, setEmail] = useState('');
  const [isEditingNickname, setIsEditingNickname] = useState(false);

  // 컴포넌트가 마운트되면 사용자 정보로 상태 업데이트
  useEffect(() => {
    const getLanguageFromCode = (code) => {
      return LANGUAGE_MAP[code] || 'English';
    };

    if (authenticated){
      console.log('User:', user);
    }
    
    if (authenticated && user) {
      setNickname(user.username || 'Nickname');
      setLanguage(getLanguageFromCode(user.transLang) || 'English');
      setEmail(user.email || '');
    } else {
      // 인증되지 않은 경우 로그인 페이지로 리디렉션
      navigate('/login');
    }
  }, [authenticated, user, navigate]);


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

  // 사진 버튼 클릭 핸들러
  const handlePictureButtonClick = () => {
    // 숨겨진 file input 요소 클릭
    fileInputRef.current.click();
  };

  // 사진 선택 핸들러
  const handleChoosePicture = (e) => {
    const selectedFile = e.target.files[0];
    
    if (selectedFile) {
      console.log('Selected file:', {
        name: selectedFile.name,
        type: selectedFile.type,
        size: `${(selectedFile.size / 1024).toFixed(2)} KB`
      });
      
      // 여기에 파일 처리 로직을 추가할 수 있습니다
      // 예: 파일 업로드 API 호출, 이미지 미리보기 등
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-100 to-blue-500">
      {/* 숨겨진 파일 입력 요소 */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".png,.jpg,.jpeg"
        onChange={handleChoosePicture}
        style={{ display: 'none' }}
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
                    style={{ objectPosition: 'center' }}
                  />
                ) : (
                  <span className="text-gray-500 font-medium">Edit Photo</span>
                )}
              </div>
              <button 
                className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-2 shadow-md hover:bg-blue-600 transition-colors"
                onClick={handlePictureButtonClick}
              >
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
                    {Object.entries(LANGUAGE_MAP).map(([code, name]) => (
                      <option key={code} value={name}>
                        {name}
                      </option>
                    ))}
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
        <h2 
          onClick={handleBackClick} 
          className="text-2xl font-bold text-white cursor-pointer hover:text-blue-200 transition-colors">
          SummarAIze
        </h2>
      </div>
    </div>
  );
};

export default Setting;