import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import researchImage from '../assets/images/student-research.jpg';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleClickWebLogo = () => {
    navigate('/');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you would handle authentication logic
    console.log('Login attempt with:', email, password);
    // For now, just redirect back to home after "login"
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-b from-blue-100 to-blue-500">
      {/* Left side - Login Form */}
      <div className="w-full md:w-2/5 p-8 md:p-12 flex flex-col justify-center">
        <div className="mb-4 text-left">
        <h2 
            onClick={handleClickWebLogo} 
            className="text-blue-600 text-xl font-bold cursor-pointer hover:text-blue-800 transition-colors inline-block"
            title="Back to Home"
          >
            SummarAIze
          </h2>
          <h1 className="text-gray-800 text-4xl font-bold">Log in</h1>
          <p className="text-gray-500 mt-3 font-semibold">Enter your email and password to log in</p>
        </div>
        
        <form onSubmit={handleSubmit} className="mt-2">
          <div className="mb-4">
            <input
              type="email"
              id="email"
              className="w-full px-4 py-2.5 rounded-full bg-white border border-gray-200 focus:outline-none focus:border-blue-500"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-4">
            <input
              type="password"
              id="password"
              className="w-full px-4 py-2.5 rounded-full bg-white border border-gray-200 focus:outline-none focus:border-blue-500"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="flex-1 flex justify-end">
            <button
              type="submit"
              className="w-1/2 bg-blue-600 text-white py-3 rounded-full font-medium hover:bg-blue-700 transition-colors"
            >
              Log in
            </button>
          </div>
        </form>

        <div className="flex mt-3 text-left ml-2">
          {/* Left side - Help links */}
          <div className="flex-1 text-sm flex flex-col space-y-2">
            <a href="#" className="text-white font-semibold hover:text-blue-700 text-base">
              Any help?
            </a>
            <a href="#" className="text-white font-semibold hover:text-blue-700 text-base">
              Forgot PW
            </a>
            <a href="#" className="text-white font-semibold hover:text-blue-700 text-base">
              Policy
            </a>
          </div>
        </div>
        
      </div>
      
      {/* Right side - Image and Text */}
      <div className="hidden m-3 md:flex md:w-3/5 bg-blue-200 relative rounded-2xl shadow-lg overflow-hidden">
        {/* Overlay with semi-transparent gradient */}
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
        
        {/* Background image */}
        <img 
          src={researchImage}
          alt="Student researching" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Text overlay */}
        <div className="absolute bottom-12 left-12 right-12 text-white text-left">
          <h2 className="text-4xl font-bold mb-4" style={{ textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)' }}>Smart Summary, Smarter Research</h2>
          <p className="text-xl mb-1" style={{ textShadow: '0 2px 6px rgba(0, 0, 0, 0.7)' }}>Upload, Summarize, Understand.</p>
          <p className="text-xl mb-1" style={{ textShadow: '0 2px 6px rgba(0, 0, 0, 0.7)' }}>Let AI distill knowledge, so you can focus on insights.</p>
          <p className="text-xl" style={{ textShadow: '0 2px 6px rgba(0, 0, 0, 0.7)' }}>From paper to key points in seconds.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;