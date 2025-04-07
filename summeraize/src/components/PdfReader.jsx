import React, { useState } from 'react';

const SimplePdfReader = ({ pdfUrl = 'https://arxiv.org/pdf/1804.08150' }) => {
  const [isLoading, setIsLoading] = useState(true);

  // Google PDF Viewer를 사용한 URL 생성
  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`;

  // PDF 로딩 완료 처리
  const handleLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 로딩 표시 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 z-10">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-2 font-medium text-gray-700">PDF 로딩 중...</p>
          </div>
        </div>
      )}

      {/* PDF 뷰어 (Google PDF Viewer 사용) */}
      <div className="flex-1">
        <iframe
          src={googleViewerUrl}
          title="PDF Viewer"
          className="w-full h-full border-none"
          onLoad={handleLoad}
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default SimplePdfReader;