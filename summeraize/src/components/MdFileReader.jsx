import React from 'react';
import ReactMarkdown from 'react-markdown';

const MdFileReader = ({ markdownContent }) => {
  return (
    <div className="h-full overflow-auto bg-white bg-opacity-90">
      <div className="prose max-w-none p-6 text-left">
        <ReactMarkdown
          components={{
            // Custom styling for markdown elements
            h1: ({ node, ...props }) => (
              <h1 className="text-2xl font-bold text-black mb-4" {...props} />
            ),
            h2: ({ node, ...props }) => (
              <h2 className="text-xl font-semibold text-black mt-6 mb-3" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="text-lg font-medium text-black-500 mt-4 mb-2" {...props} />
            ),
            ul: ({ node, ...props }) => (
              <ul className="list-disc pl-6 mb-4" {...props} />
            ),
            li: ({ node, ...props }) => (
              <li className="mb-1" {...props} />
            ),
            p: ({ node, ...props }) => (
              <p className="mb-4 text-gray-700" {...props} />
            ),
          }}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MdFileReader;