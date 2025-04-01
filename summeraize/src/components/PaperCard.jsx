import React from 'react';

const PaperCard = ({ paper, onToggleStar, onClick }) => {
  // Star 버튼 클릭 시 이벤트 버블링 방지
  const handleStarClick = (e) => {
    e.stopPropagation();
    onToggleStar();
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      {/* PDF 아이콘 영역 */}
      <div className="h-48 bg-gray-50 flex items-center justify-center border-b">
        <div className="text-center">
          <svg 
            className="w-12 h-12 text-red-500 mx-auto" 
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M8 16h8v2H8zm0-4h8v2H8zm6-10H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
          </svg>
          <div className="mt-2 text-sm font-medium text-gray-700">PDF Document</div>
        </div>
      </div>

      {/* 상세 정보 영역 */}
      <div className="p-4 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-gray-800">{paper.title}</h3>
          <p className="text-sm text-gray-500 mt-1">{paper.date} {paper.time}</p>
        </div>

        {/* Star 버튼 */}
        <button 
          className="p-1"
          onClick={handleStarClick}
        >
          <svg 
            className={`w-6 h-6 ${paper.starred ? 'text-yellow-400' : 'text-gray-300'}`} 
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default PaperCard;