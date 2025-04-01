import React, { useState, useCallback } from 'react';
import '../styles/pages/Home.css'; // Adjust the path as necessary

const Home = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

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
    handleFileSelect(files);
  };

  
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter(file => 
        file.type === 'application/pdf' || 
        file.name.endsWith('.docx')
      );
      
      if (validFiles.length > 0) {
        // Handle file processing
        console.log('Files to process:', validFiles);
        // Here you would call your file processing service/function
      }
    }
  };

  return (
    <div className="home-container">

      <div className="auth-button">
        <button onClick={() => console.log('Sign in/Log in clicked')}>
          Sign in or Log in
        </button>
      </div>
      
      <div 
        className={`dropzone ${isDragging ? 'dragging' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="dropzone-content">
          <div className="upload-icon">
            <img src="/upload-icon.png" alt="Upload" />
          </div>
          <h1>Drag & Drop</h1>
          <p className="upload-text">your file here or browse to upload</p>
          <p className="file-types">Only docx and pdf files are available</p>
          
          <input 
            type="file" 
            id="file-upload" 
            accept=".pdf,.docx" 
            onChange={handleFileSelect} 
            style={{ display: 'none' }} 
          />
          <label htmlFor="file-upload" className="browse-button">
            Browse Files
          </label>
        </div>
      </div>
      
      <div className="app-name">
        <h2>SummarAIze</h2>
      </div>
    </div>
  );
};

export default Home;