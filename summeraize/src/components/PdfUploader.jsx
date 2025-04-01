// PDF upload component
import React, { useState } from 'react';

const PdfUploader = ({ onFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };
  
  const handleFiles = (fileList) => {
    const files = Array.from(fileList);
    const validFiles = files.filter(file => 
      file.type === 'application/pdf' || 
      file.name.endsWith('.docx')
    );
    
    if (validFiles.length > 0) {
      // Pass the valid files to the parent component
      if (onFileUpload) {
        onFileUpload(validFiles);
      }
    } else {
      alert('Please upload only PDF or DOCX files');
    }
  };

  return (
    <div 
      className={`w-full max-w-lg h-72 bg-white rounded-2xl shadow-lg flex items-center justify-center my-auto transition-all duration-300 border-2 border-dashed ${isDragging ? 'border-blue-500 border-3 shadow-blue-200 scale-102 bg-blue-50' : 'border-gray-300'}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`flex flex-col items-center p-8 text-center transition-transform duration-300 ${isDragging ? 'scale-105' : ''}`}>
        {/* Upload Icon */}
        <div className={`w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-5 transition-all duration-300 ${isDragging ? 'bg-blue-600 scale-110' : ''}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Drag & Drop</h1>
        <p className="text-gray-600 mb-1">your file here or browse to upload</p>
        <p className="text-gray-400 text-sm mb-5">Only docx and pdf files are available</p>
        
        <input 
          type="file" 
          id="file-upload" 
          accept=".pdf,.docx" 
          onChange={handleFileInputChange} 
          className="hidden" 
        />
        <label 
          htmlFor="file-upload" 
          className="bg-blue-500 text-white px-5 py-2 rounded-lg text-sm cursor-pointer transition-all hover:bg-blue-600 hover:-translate-y-1 hover:shadow-md"
        >
          Browse Files
        </label>
      </div>
    </div>
  );
};

export default PdfUploader;