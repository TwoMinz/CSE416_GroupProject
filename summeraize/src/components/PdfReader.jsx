import React, { useState } from 'react';
import Testpdf from '../assets/resources/test.pdf';

const SimplePdfReader = ({ pdfUrl = '/assets/resources/test.pdf' }) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  
  // zoom 기능 (iframe에 직접적인 영향은 없지만 UI에 표시용)
  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const zoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* 상단 컨트롤 */}
      <div className="p-4 flex justify-between items-center border-b border-gray-200 bg-blue-500 text-white">
        <h2 className="text-xl font-semibold">Original Document</h2>
        <div className="flex items-center space-x-2">
          <button 
            onClick={zoomOut} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white bg-opacity-20 text-white hover:bg-opacity-30"
            title="Zoom out"
          >
            -
          </button>
          <span className="text-white mx-2">{zoomLevel}%</span>
          <button 
            onClick={zoomIn} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white bg-opacity-20 text-white hover:bg-opacity-30"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* PDF 뷰어 (iframe 사용) */}
      <div className="flex-1 bg-gray-50">
        <iframe
          src={Testpdf}
          title="PDF Viewer"
          className="w-full h-full border-none"
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default SimplePdfReader;