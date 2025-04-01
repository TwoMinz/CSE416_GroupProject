import React from 'react';
import ReactMarkdown from 'react-markdown';

const MdFileReader = ({ markdownContent }) => {
  return (
    <div className="h-full overflow-auto bg-white p-6">
      <div className="prose max-w-none">
        <ReactMarkdown>
          {markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MdFileReader;