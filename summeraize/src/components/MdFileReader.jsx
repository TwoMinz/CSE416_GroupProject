import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

const MdFileReader = ({ markdownContent, markdownUrl }) => {
  const [content, setContent] = useState(markdownContent || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // URL이 있으면 fetch를 통해 컨텐츠 가져오기
  useEffect(() => {
    if (!markdownUrl) return;

    const fetchMarkdown = async () => {
      setIsLoading(true);
      try {
        // URL을 통해 마크다운 파일 직접 요청
        const response = await fetch(markdownUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch: ${response.status} ${response.statusText}`
          );
        }
        const text = await response.text();
        setContent(text);
        setError(null);
      } catch (err) {
        console.error("Markdown fetch error:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarkdown();
  }, [markdownUrl]);

  // 직접 content가 들어오면 그것을 사용
  useEffect(() => {
    if (markdownContent) {
      setContent(markdownContent);
    }
  }, [markdownContent]);

  return (
    <div
      className="h-full overflow-y-auto bg-white bg-opacity-90"
      style={{ scrollbarWidth: "thin" }}
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <span className="ml-3 text-gray-700">Loading summary...</span>
        </div>
      ) : error ? (
        <div className="p-6 text-red-600">
          <h3 className="font-bold text-lg mb-2">Error loading summary</h3>
          <p>{error}</p>
        </div>
      ) : (
        <div className="prose max-w-none p-6 text-left">
          <ReactMarkdown
            components={{
              h1: ({ node, children, ...props }) => (
                <h1 className="text-2xl font-bold text-black mb-4" {...props}>
                  {children}
                </h1>
              ),
              h2: ({ node, children, ...props }) => (
                <h2
                  className="text-xl font-semibold text-black mt-6 mb-3"
                  {...props}
                >
                  {children}
                </h2>
              ),
              h3: ({ node, children, ...props }) => (
                <h3
                  className="text-lg font-medium text-black-500 mt-4 mb-2"
                  {...props}
                >
                  {children}
                </h3>
              ),
              ul: ({ node, children, ...props }) => (
                <ul className="list-disc pl-6 mb-4" {...props}>
                  {children}
                </ul>
              ),
              li: ({ node, children, ...props }) => (
                <li className="mb-1" {...props}>
                  {children}
                </li>
              ),
              p: ({ node, children, ...props }) => (
                <p className="mb-4 text-gray-700" {...props}>
                  {children}
                </p>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}

      <style>{`
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        .overflow-y-auto::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 3px;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  );
};

export default MdFileReader;
