// PDF upload component
import React, { useState } from 'react';
import uploadIcon from '../assets/images/upload-icon.png';

const PdfUploader = ({ onFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);

  // Function to handle drag enter event
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // Function to handle drag leave event
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // Function to handle drag over event
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };
  
  // Function to handle file drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  // Function to handle file input change
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      console.log("Files selected:", e.target.files);
    }
  };
  
  // Function to handle the files after drag and drop or file input change
  const handleFiles = (fileList) => {
    const files = Array.from(fileList);
    const validFiles = files.filter(file => 
      file.type === 'application/pdf'
    );
    
    if (validFiles.length > 0) {
      // Pass the valid files to the parent component
      if (onFileUpload) {
        onFileUpload(validFiles);
      }
    } else {
      alert('Please upload only PDF files');
    }
  };

  return (
    <div 
      className={`w-200 h-72 bg-white rounded-2xl shadow-lg flex items-center justify-center my-auto transition-all duration-300 border-2 border-dashed ${isDragging ? 'border-blue-500 border-3 shadow-blue-200 scale-102 bg-blue-50' : 'border-gray-300'}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div>
        {/* Upload Icon */}
        <div className='flex justify-center items-center mb-4 '>
          <img 
            src={uploadIcon} 
            alt="Upload" 
            className="w-16 h-16 object-contain"
            draggable="false"
          />
        </div>
        
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Drag & Drop</h1>
        <p className="text-gray-600 mb-1">your file here or browse to upload</p>
        <p className="text-gray-400 text-sm mb-5">Only pdf files are available</p>
        
        <input 
          type="file" 
          id="file-upload" 
          accept=".pdf" 
          onChange={handleFileInputChange} 
          className="hidden" 
        />
      </div>
    </div>
  );
};

export default PdfUploader;