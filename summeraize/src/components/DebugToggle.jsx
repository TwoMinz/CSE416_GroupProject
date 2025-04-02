import React from 'react';
import { useNavigate } from 'react-router-dom';

const DebugToggle = ({ isLoggedIn, onToggleLogin }) => {
  const navigate = useNavigate();

  const handleGoToLibrary = () => {
    navigate('/library');
  };

  const handleGoToBookStand = () => {
    navigate('/BookStand');
  };

  return (
    <div className="absolute top-5 left-5 z-10 flex flex-col space-y-2">
      <button 
        onClick={onToggleLogin}
        className="bg-gray-800 text-white px-3 py-1 rounded-md text-sm shadow-md hover:bg-gray-700 transition-colors duration-200"
      >
        {isLoggedIn ? 'Debugger-Status: Logged-in' : 'Debugger-Status: Logged-out'}
      </button>
      
      <button 
        onClick={handleGoToLibrary}
        className="bg-gray-800 text-white px-3 py-1 rounded-md text-sm shadow-md hover:bg-gray-700 transition-colors duration-200"
      >
        Go to Library
      </button>

      <button 
        onClick={handleGoToBookStand}
        className="bg-gray-800 text-white px-3 py-1 rounded-md text-sm shadow-md hover:bg-gray-700 transition-colors duration-200"
      >
        Go to Library
      </button>
    </div>
  );
};

export default DebugToggle;