import React from 'react';

const DebugToggle = ({ isLoggedIn, onToggleLogin }) => {
  return (
    <div className="absolute top-5 left-5 z-10">
      <button 
        onClick={onToggleLogin}
        className="bg-gray-800 text-white px-3 py-1 rounded-md text-sm shadow-md hover:bg-gray-700 transition-colors duration-200"
      >
        {isLoggedIn ? 'Debugger-Status: Logged-in' : 'Debugger-Status: Logged-out'}
      </button>
    </div>
  );
};

export default DebugToggle;