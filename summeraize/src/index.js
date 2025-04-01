import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';  // 전역 스타일 추가
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);