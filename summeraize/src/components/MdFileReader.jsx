import React from 'react';
import ReactMarkdown from 'react-markdown';

const MdFileReader = ({ markdownContent }) => {
  return (
    <div className="h-full overflow-y-auto bg-white bg-opacity-90" style={{ scrollbarWidth: 'thin' }}>
      <div className="prose max-w-none p-6 text-left">
        <ReactMarkdown
          components={{
            h1: ({ node, children, ...props }) => (
              <h1 className="text-2xl font-bold text-black mb-4" {...props}>
                {children}
              </h1>
            ),
            h2: ({ node, children, ...props }) => (
              <h2 className="text-xl font-semibold text-black mt-6 mb-3" {...props}>
                {children}
              </h2>
            ),
            h3: ({ node, children, ...props }) => (
              <h3 className="text-lg font-medium text-black-500 mt-4 mb-2" {...props}>
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
          {markdownContent}
        </ReactMarkdown>
      </div>
      
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