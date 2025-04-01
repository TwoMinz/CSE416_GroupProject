import React, { useState } from 'react';
import PdfUploader from '../components/PdfUploader';
import Signin from '../components/Signin';
import UserToggle from '../components/UserToggle';
import DebugToggle from '../components/DebugToggle';

const Home = () => {
  // 로그인 상태 관리
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleFileUpload = (files) => {
    console.log('Files received in Home component:', files);
    // 파일 업로드 처리 로직
  };

  // 로그인 상태 토글 (디버깅용)
  const toggleLoginState = () => {
    setIsLoggedIn(!isLoggedIn);
    console.log('Login state toggled:', !isLoggedIn);
  };

  // UserToggle 옵션 핸들러 함수
  const handleArchiveClick = () => {
    console.log('Archive clicked');
  };

  const handleSettingClick = () => {
    console.log('Setting clicked');
  };

  const handleLogoutClick = () => {
    setIsLoggedIn(false);
    console.log('Logged out');
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between bg-gradient-to-b from-blue-100 to-blue-500 relative p-5">
      {/* 디버그 토글 - 테스트용 */}
      <DebugToggle isLoggedIn={isLoggedIn} onToggleLogin={toggleLoginState} />
      
      {/* 로그인 버튼 또는 사용자 토글 컴포넌트 */}
      <div className="absolute top-5 right-5">
        {isLoggedIn ? (
          <UserToggle 
            onArchiveClick={handleArchiveClick}
            onSettingClick={handleSettingClick}
            onLogoutClick={handleLogoutClick}
          />
        ) : (
          <Signin onClick={toggleLoginState} />
        )}
      </div>
      
      {/* PDF 업로더 컴포넌트 */}
      <div className="flex-grow flex items-center justify-center w-full">
        <PdfUploader onFileUpload={handleFileUpload} />
      </div>
      
      {/* 앱 이름 */}
      <div className="mt-auto pt-5">
        <h2 className="text-2xl font-bold text-white drop-shadow-sm">SummarAIze</h2>
      </div>
    </div>
  );
};

export default Home;