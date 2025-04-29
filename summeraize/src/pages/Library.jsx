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

  // Handle star toggle
  const handleToggleStar = async (paperId, isStarred) => {
    console.log("Star toggled for", paperId, "New state:", isStarred);
    // TODO: Implement API call to toggle star status
  };

  // Handle paper click to navigate to BookStand
  const handlePaperClick = (paperId) => {
    navigate("/bookstand", { state: { paperId } });
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
          {!loading && !error && papers.length === 0 && (
            <div className="text-center py-16">
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
            </div>
          )}

          {/* Library grid */}
          {!loading && !error && papers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {papers.map((paper) => (
                <div className="flex justify-center" key={paper.id}>
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
      </div>
    </div>
  );
};

export default Library;
