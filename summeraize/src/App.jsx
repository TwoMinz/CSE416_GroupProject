import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Login from './pages/Login';
import Library from './pages/Library';
import BookStand from './pages/BookStand';
import Setting from './pages/Setting';
import Signup from './pages/Signup';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/library" element={<Library />} />
          <Route path="/bookstand" element={<BookStand />} />
          <Route path="/setting" element={<Setting />} />
          
        </Routes>
      </div>
    </Router>
  );
}

export default App;