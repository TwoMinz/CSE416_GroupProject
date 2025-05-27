import React, { useState, useEffect, useCallback } from "react";

const SimplePdfReader = ({ pdfUrl, onUrlExpired }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // PDF 로딩 에러 처리 - URL 유효성 검사 제거
  const handleIframeError = useCallback(async () => {
    console.error("PDF iframe failed to load");

    if (!pdfUrl) return;

    // URL 만료 가능성이 높으므로 바로 새 URL 요청
    if (retryCount === 0) {
      console.log("First attempt failed, requesting fresh URL");
      if (onUrlExpired) {
        onUrlExpired();
      }
      setError("PDF loading failed. Refreshing URL...");
      return;
    }

    if (retryCount < maxRetries) {
      setRetryCount((prev) => prev + 1);
      setError(`Loading failed. Retrying... (${retryCount + 1}/${maxRetries})`);

      // 재시도 전 잠시 대기
      setTimeout(() => {
        setIsLoading(true);
        setError(null);
      }, 2000);
    } else {
      setError(
        "Failed to load PDF after multiple attempts. Please refresh the page."
      );
    }
  }, [pdfUrl, retryCount, maxRetries, onUrlExpired]);

  // PDF 로딩 완료 처리
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setRetryCount(0);
  }, []);

  // pdfUrl이 변경될 때 상태 초기화
  useEffect(() => {
    if (pdfUrl) {
      setIsLoading(true);
      setError(null);
      setRetryCount(0);
    }
  }, [pdfUrl]);

  // 로딩 타임아웃 설정 - 항상 실행되도록 수정
  useEffect(() => {
    // pdfUrl이 없으면 타이머 설정하지 않음
    if (!pdfUrl) return;

    const timer = setTimeout(() => {
      if (isLoading) {
        handleIframeError();
      }
    }, 15000); // 15초 타임아웃

    return () => clearTimeout(timer);
  }, [isLoading, handleIframeError, pdfUrl]);

  // PDF가 없는 경우 메시지 표시
  if (!pdfUrl) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-6">
          <p className="text-gray-600 font-medium">PDF not available yet.</p>
          <p className="text-gray-500 text-sm mt-2">
            The document is still being processed...
          </p>
        </div>
      </div>
    );
  }

  // Google PDF Viewer를 사용한 URL 생성
  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(
    pdfUrl
  )}&embedded=true`;

  // 대체 뷰어 URL (Mozilla PDF.js)
  const pdfJsUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
    pdfUrl
  )}`;

  return (
    <div className="h-full flex flex-col">
      {/* 로딩 표시 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 z-10">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-2 font-medium text-gray-700">
              Loading PDF... {retryCount > 0 && `(Attempt ${retryCount + 1})`}
            </p>
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center p-6 max-w-md">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <p className="text-gray-700 font-medium mb-4">{error}</p>
            {retryCount >= maxRetries && (
              <div className="space-y-2">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-2"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => {
                    setRetryCount(0);
                    setError(null);
                    setIsLoading(true);
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF 뷰어 */}
      <div className="flex-1">
        <iframe
          key={`pdf-${retryCount}`} // 재시도시 iframe 재생성
          src={retryCount % 2 === 0 ? googleViewerUrl : pdfJsUrl} // 교대로 다른 뷰어 사용
          title="PDF Viewer"
          className="w-full h-full border-none"
          onLoad={handleLoad}
          onError={handleIframeError}
          loading="lazy"
          // PDF 로딩을 위한 추가 속성
          allow="fullscreen"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
    </div>
  );
};

export default SimplePdfReader;
