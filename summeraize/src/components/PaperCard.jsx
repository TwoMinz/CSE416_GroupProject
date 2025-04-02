import React, { useState } from 'react';
import starredIcon from '../assets/images/colored-star.png';
import unstarredIcon from '../assets/images/uncolored-star.png';
import pdfIcon from '../assets/images/pdf-icon.png';
import paperCover from '../assets/images/paper-cover.png';

const PaperCard = ({ paper, onToggleStar, onClick }) => {
  // 내부 상태로 별 표시 여부 관리 (실시간 UI 업데이트를 위함)
  const [isStarred, setIsStarred] = useState(paper.starred);
  
  // Star 버튼 클릭 시 이벤트 버블링 방지 및 상태 변경
  const handleStarClick = (e) => {
    e.stopPropagation();
    setIsStarred(!isStarred);
    onToggleStar();
  };

  return (
    <div className="bg-white rounded-3xl shadow-md overflow-hidden w-64 mx-auto relative m-4">
      {/* 별 및 PDF 아이콘을 위한 상단 여백 영역 */}
      <div className="h-12"></div>
      
      {/* Star 표시 - 왼쪽 상단에 절대 위치 */}
      <div className="absolute left-3 top-3 z-10">
        <button 
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          onClick={handleStarClick}
        >
          <img 
            src={isStarred ? starredIcon : unstarredIcon} 
            alt={isStarred ? "Starred" : "Not starred"} 
            className="w-6 h-6" 
          />
        </button>
      </div>

      {/* PDF 아이콘 - 오른쪽 상단에 절대 위치 */}
      <div className="absolute right-3 top-3 z-10">
        <img 
          src={pdfIcon} 
          alt="PDF" 
          className="w-8 h-8" 
        />
      </div>

      {/* 논문 커버 이미지 - 클릭 가능 */}
      <div 
        className="px-4 cursor-pointer"
        onClick={onClick}
      >
        <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
          <img 
            src={paperCover} 
            alt="Paper cover" 
            className="w-full object-cover"
          />
        </div>
      </div>

      {/* 상세 정보 영역 - 클릭 가능 */}
      <div 
        className="p-4 text-center cursor-pointer"
        onClick={onClick}
      >
        <h3 className="text-xl font-bold text-gray-800">{paper.title}</h3>
        <p className="text-sm text-gray-500 mt-1">{paper.date} {paper.time}</p>
      </div>
    </div>
  );
};

export default PaperCard;