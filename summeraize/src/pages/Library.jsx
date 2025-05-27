// Library.jsx - 실패한 논문들 간단히 숨기기
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PaperCard from "../components/PaperCard";
import UserToggle from "../components/UserToggle";
import { loadLibrary } from "../services/api";
import { useAuth } from "../context/AuthContext";

const Library = () => {
  const navigate = useNavigate();
  const { user, authenticated, logout } = useAuth();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFailedPapers, setShowFailedPapers] = useState(false);

  const handleClickWebLogo = () => {
    navigate("/");
  };

  // Fetch papers from the library API
  useEffect(() => {
    const fetchPapers = async () => {
      if (!authenticated || !user) {
        navigate("/login");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("summaraize-token");
        const response = await loadLibrary(user.userId, token);

        if (response.success) {
          setPapers(response.papers || []);
        } else {
          setError(response.message || "Failed to load library");
        }
      } catch (error) {
        console.error("Error loading library:", error);
        setError("Error loading library. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchPapers();
  }, [authenticated, user, navigate]);

  // 표시할 논문들 필터링 - 기본적으로 실패한 논문은 숨김
  const getDisplayedPapers = () => {
    if (!papers) return [];

    if (showFailedPapers) {
      return papers; // 모든 논문 표시
    } else {
      return papers.filter((paper) => paper.status !== "failed"); // 실패한 논문 제외
    }
  };

  // 논문 통계 계산
  const getPaperStats = () => {
    if (!papers) return { completed: 0, processing: 0, failed: 0, total: 0 };

    return {
      completed: papers.filter((p) => p.status === "completed").length,
      processing: papers.filter((p) => p.status === "processing").length,
      failed: papers.filter((p) => p.status === "failed").length,
      total: papers.length,
    };
  };

  const stats = getPaperStats();
  const displayedPapers = getDisplayedPapers();

  // Handle star toggle
  const handleToggleStar = async (paperId, isStarred) => {
    console.log("Star toggled for", paperId, "New state:", isStarred);
    // TODO: Implement API call to toggle star status
  };

  // Handle paper click to navigate to BookStand
  const handlePaperClick = (paperId) => {
    const paper = papers.find((p) => p.id === paperId);

    // 완료된 논문만 BookStand로 이동 가능
    if (paper && paper.status === "completed") {
      console.log("Navigating to BookStand with paperId:", paperId);
      navigate("/bookstand", {
        state: {
          paperId: paperId,
        },
      });
    } else if (paper && paper.status === "processing") {
      alert(
        "This paper is still being processed. Please wait for it to complete."
      );
    } else if (paper && paper.status === "failed") {
      alert("This paper failed to process. Please try uploading it again.");
    }
  };

  // Handle user options
  const handleLogoutClick = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const getStatusColor = () => {
      switch (status) {
        case "completed":
          return "bg-green-100 text-green-800";
        case "processing":
          return "bg-blue-100 text-blue-800";
        case "failed":
          return "bg-red-100 text-red-800";
        default:
          return "bg-gray-100 text-gray-800";
      }
    };

    const getStatusText = () => {
      switch (status) {
        case "completed":
          return "Ready";
        case "processing":
          return "Processing...";
        case "failed":
          return "Failed";
        default:
          return "Unknown";
      }
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}
      >
        {status === "processing" && (
          <svg
            className="animate-spin -ml-1 mr-1 h-3 w-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {getStatusText()}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-500 flex flex-col">
      {/* User menu */}
      <div className="absolute top-5 right-5 z-10">
        <UserToggle
          onArchiveClick={() => {}} // Already on Archive/Library page
          onSettingClick={() => console.log("Setting clicked")}
          onLogoutClick={handleLogoutClick}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 flex justify-center items-center">
        <div
          className="bg-white bg-opacity-60 rounded-3xl p-8 backdrop-blur-sm shadow-lg w-5/6 max-w-6xl mx-auto my-16 overflow-y-auto"
          style={{
            height: "calc(100vh - 200px)",
            width: "95%",
            scrollbarWidth: "none",
          }}
        >
          <style>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {/* Library Header */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-3xl font-bold text-gray-800">Your Library</h1>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && displayedPapers.length === 0 && (
            <div className="text-center py-16">
              {stats.total === 0 ? (
                <>
                  <h3 className="text-2xl font-semibold text-gray-600 mb-2">
                    Your library is empty
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Upload papers from the home page to see them here
                  </p>
                  <button
                    onClick={() => navigate("/")}
                    className="bg-blue-500 text-white px-6 py-2 rounded-full hover:bg-blue-600 transition-colors"
                  >
                    Upload Paper
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-semibold text-gray-600 mb-2">
                    All papers are hidden
                  </h3>
                  <p className="text-gray-500 mb-6">
                    You have {stats.failed} failed papers. Check "Show failed
                    papers" to see them.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => setShowFailedPapers(true)}
                      className="bg-gray-500 text-white px-6 py-2 rounded-full hover:bg-gray-600 transition-colors"
                    >
                      Show Failed Papers
                    </button>
                    <button
                      onClick={() => navigate("/")}
                      className="bg-blue-500 text-white px-6 py-2 rounded-full hover:bg-blue-600 transition-colors"
                    >
                      Upload New Paper
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Library grid */}
          {!loading && !error && displayedPapers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayedPapers.map((paper) => (
                <div className="flex justify-center relative" key={paper.id}>
                  {/* Status badge overlay - 완료가 아닌 경우에만 표시 */}
                  {paper.status !== "completed" && (
                    <div className="absolute top-2 left-2 z-10">
                      <StatusBadge status={paper.status} />
                    </div>
                  )}

                  <PaperCard
                    key={paper.id}
                    paper={{
                      id: paper.id,
                      title: paper.title,
                      date: new Date(paper.uploadDate).toLocaleDateString(
                        "en-US",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }
                      ),
                      time: new Date(paper.uploadDate).toLocaleTimeString(
                        "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      ),
                      starred: paper.starred || false,
                      status: paper.status,
                    }}
                    onToggleStar={() =>
                      handleToggleStar(paper.id, !paper.starred)
                    }
                    onClick={() => handlePaperClick(paper.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* App name */}
      <div className="text-center mb-2">
        <h2
          onClick={handleClickWebLogo}
          className="text-white text-2xl font-bold cursor-pointer hover:text-blue-100 transition-colors inline-block mb-2"
          title="Back to Home"
        >
          SummarAIze
        </h2>

        {authenticated && user && (
          <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/50">
              <img
                src={user.profilePicture}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = "/default-avatar.png";
                }}
              />
            </div>
            <span className="text-white text-sm font-medium">
              {user.username}'s Library
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
