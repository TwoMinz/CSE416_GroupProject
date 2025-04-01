import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// PDF.js 워커 설정
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PdfReader = ({ pdfFile }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  // PDF 문서 로드 성공 핸들러
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  // 페이지 이동 함수
  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages || 1));
  };

  return (
    <div className="h-full flex flex-col">
      {/* 간단한 페이지 컨트롤 */}
      <div className="p-2 flex justify-between border-b border-gray-200">
        <button 
          onClick={goToPrevPage} 
          disabled={pageNumber <= 1}
          className="px-2 py-1 bg-gray-100 rounded disabled:opacity-50"
        >
          이전
        </button>
        <span>
          {pageNumber} / {numPages || '--'}
        </span>
        <button 
          onClick={goToNextPage} 
          disabled={pageNumber >= numPages}
          className="px-2 py-1 bg-gray-100 rounded disabled:opacity-50"
        >
          다음
        </button>
      </div>

      {/* PDF 뷰어 */}
      <div className="flex-1 overflow-auto flex justify-center p-2">
        <Document
          file={pdfFile}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<p className="text-center p-4">PDF 로딩 중...</p>}
        >
          <Page 
            pageNumber={pageNumber} 
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
};

export default PdfReader;