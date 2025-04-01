import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// PDF.js worker configuration
// 1. 프로토콜을 명시적으로 https로 지정 (혼합 콘텐츠 문제 방지)
// 2. 버전을 명시적으로 지정 (최신 안정 버전 사용)
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js`;

const PdfReader = ({ pdfFile }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [error, setError] = useState(null);

  // PDF document load success handler
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setError(null);
  };

  // PDF document load error handler
  const onDocumentLoadError = (error) => {
    console.error("PDF 로딩 오류:", error);
    setError("PDF 파일을 로드하는 중 오류가 발생했습니다.");
  };

  // Page navigation functions
  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages || 1));
  };

  // Zoom functions
  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.1, 2.0));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Page controls */}
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
          <button 
            onClick={zoomIn} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white bg-opacity-20 text-white hover:bg-opacity-30"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Navigation controls */}
      <div className="px-4 py-2 flex justify-between items-center bg-gray-100">
        <button 
          onClick={goToPrevPage} 
          disabled={pageNumber <= 1}
          className="px-3 py-1 bg-blue-500 text-white rounded-full disabled:opacity-50 disabled:bg-gray-400 text-sm"
        >
          Previous
        </button>
        <span className="text-gray-700 font-medium">
          Page {pageNumber} of {numPages || '--'}
        </span>
        <button 
          onClick={goToNextPage} 
          disabled={pageNumber >= numPages}
          className="px-3 py-1 bg-blue-500 text-white rounded-full disabled:opacity-50 disabled:bg-gray-400 text-sm"
        >
          Next
        </button>
      </div>

      {/* PDF viewer */}
      <div className="flex-1 overflow-auto flex justify-center p-4 bg-gray-50">
        {error ? (
          <div className="flex items-center justify-center h-full text-red-500">
            {error}
          </div>
        ) : (
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-blue-500">Loading PDF...</div>
              </div>
            }
          >
            <Page 
              pageNumber={pageNumber} 
              renderTextLayer={true}
              renderAnnotationLayer={true}
              scale={scale}
              className="shadow-lg"
              error="PDF 페이지를 로드할 수 없습니다."
            />
          </Document>
        )}
      </div>
    </div>
  );
};

export default PdfReader;