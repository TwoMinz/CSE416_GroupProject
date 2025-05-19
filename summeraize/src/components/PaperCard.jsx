import React, { useState, useEffect } from "react";
import starredIcon from "../assets/images/colored-star.png";
import unstarredIcon from "../assets/images/uncolored-star.png";
import pdfIcon from "../assets/images/pdf-icon.png";
import paperCover from "../assets/images/paper-cover.png";

const PaperCard = ({ paper, onToggleStar, onClick }) => {
  // Internal state for starred status (for immediate UI feedback)
  const [isStarred, setIsStarred] = useState(paper.starred);

  // Update internal state when prop changes (e.g., after API call completes)
  useEffect(() => {
    setIsStarred(paper.starred);
  }, [paper.starred]);

  // Handle star click - prevent event bubbling and call parent handler
  const handleStarClick = (e) => {
    e.stopPropagation();
    setIsStarred(!isStarred);
    onToggleStar(paper.id, !isStarred);
  };

  // Handle click on the card or its elements - use the parent's onClick
  const handleCardClick = () => {
    if (onClick) {
      onClick(paper.id);
    }
  };

  return (
    <div
      className="bg-white rounded-3xl shadow-md overflow-hidden w-64 mx-auto relative m-4 transition-all duration-300 hover:shadow-xl cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Top margin area for icons */}
      <div className="h-12"></div>

      {/* Star icon - absolute positioned */}
      {/*
      <div className="absolute left-3 top-3 z-10">
        <button
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          onClick={handleStarClick}
          aria-label={isStarred ? "Remove from favorites" : "Add to favorites"}
        >
          <img
            src={isStarred ? starredIcon : unstarredIcon}
            alt={isStarred ? "Starred" : "Not starred"}
            className="w-6 h-6"
          />
        </button>
      </div>
      */}
      {/* PDF icon - absolute positioned */}
      <div className="absolute right-3 top-3 z-10">
        <img src={pdfIcon} alt="PDF" className="w-8 h-8" />
      </div>

      {/* Paper cover image */}
      <div className="px-4">
        <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
          <img
            src={paperCover}
            alt="Paper cover"
            className="w-full object-cover"
          />
        </div>
      </div>

      {/* Paper details */}
      <div className="p-4 text-center">
        <h3
          className="text-xl font-bold text-gray-800 truncate"
          title={paper.title}
        >
          {paper.title}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {paper.date} {paper.time}
        </p>
      </div>
    </div>
  );
};

export default PaperCard;
