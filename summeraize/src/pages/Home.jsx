import React from 'react';
import PdfUploader from '../components/PdfUploader';
import AuthButton from '../components/Signin';

const Home = () => {
  const handleFileUpload = (files) => {
    console.log('Files received in Home component:', files);
    // Here you would process the files, such as:
    // - Send to an API for processing
    // - Update application state
    // - Navigate to a different page, etc.
  };

  const handleAuthClick = () => {
    console.log('Sign in/Log in clicked');
    // Implement your authentication logic here
    // For example: navigate to login page, open a modal, etc.
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between bg-gradient-to-b from-blue-100 to-blue-500 relative p-5">
      {/* Auth Button Component */}
      <AuthButton onClick={handleAuthClick} />
      
      {/* PDF Uploader Component */}
      <div className="flex-grow flex items-center justify-center w-full">
        <PdfUploader onFileUpload={handleFileUpload} />
      </div>
      
      {/* App Name */}
      <div className="mt-auto pt-5">
        <h2 className="text-2xl font-bold text-white drop-shadow-sm">SummarAIze</h2>
      </div>
    </div>
  );
};

export default Home;