// Sign-in Component
import React from 'react';
import { useNavigate } from 'react-router-dom';



const Signin = () => {

  const navigate = useNavigate();

  const handleSignInClick = () => {
    navigate('/login');
  };

  return (
    <div className="absolute top-1 right-0">
      <button 
        className="bg-white text-gray-700 rounded-full py-1 text-sm font-medium shadow-lg w-64 hover:shadow-xl transition-all duration-300 ease-in-out"
        onClick={handleSignInClick}
      >
        Click here to <span className="text-blue-600">Sign in</span> or <span className="text-blue-600">Log in</span>
      </button>
    </div>
  );
};

export default Signin;