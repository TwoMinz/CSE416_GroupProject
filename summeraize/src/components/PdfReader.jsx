import React, { useState } from 'react';
import Testpdf from '../assets/resources/test.pdf';

const SimplePdfReader = ({ pdfUrl = '/assets/resources/test.pdf' }) => {

  return (
    <div className="h-full flex flex-col">

      {/* PDF 뷰어 (iframe 사용) */}
      <div className="flex-1">
        <iframe
          src={Testpdf}
          title="PDF Viewer"
          className="w-full h-full border-none"
          loading="lazy"
          allowTransparency="true"
          style={{ backgroundColor: 'grey', allowTransparency: 'true' }}
        />
      </div>
      
    </div>
  );
};

export default SimplePdfReader;