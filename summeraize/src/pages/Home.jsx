import React from 'react';
import PdfUploader from '../components/PdfUploader';

const Home = () => {
  const handleFileUpload = (files) => {
    console.log('Files received in Home component:', files);
    // Here you would process the files, such as:
    // - Send to an API for processing
    // - Update application state
    // - Navigate to a different page, etc.
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between bg-gradient-to-b from-blue-100 to-blue-500 relative p-5">
      {/* Auth Button */}
      <div className="absolute top-5 right-5">
        <button 
          className="bg-transparent border border-white/70 text-gray-800 px-4 py-2 rounded-full text-sm transition-all hover:bg-white/30"
          onClick={() => console.log('Sign in/Log in clicked')}
        >
          Sign in or Log in
        </button>
      </div>
      
      {/* PDF Uploader Component */}
      <PdfUploader onFileUpload={handleFileUpload} />
      
      {/* App Name */}
      <div className="mt-auto pt-5">
        <h2 className="text-2xl font-bold text-white drop-shadow-sm">SummarAIze</h2>
      </div>
    </div>
  );
};

export default Home;