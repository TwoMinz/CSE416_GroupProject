import React, { useState, useEffect, useCallback } from "react";
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    hasMore: false,
    lastEvaluatedKey: null,
  });

  const handleClickWebLogo = () => {
    navigate("/");
  };

  // Fetch papers from the library API
  const fetchPapers = useCallback(
    async (showLoader = true, isLoadMore = false, resetPagination = false) => {
      if (!authenticated || !user) {
        navigate("/login");
        return;
      }

      // Set loading states
      if (showLoader && !isLoadMore) {
        setLoading(true);
      } else if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const token = localStorage.getItem("summaraize-token");

        // Determine which lastEvaluatedKey to use
        let lastKey = null;
        if (isLoadMore && !resetPagination) {
          lastKey = pagination.lastEvaluatedKey;
        }

        console.log(
          `[LIBRARY] Fetching papers - isLoadMore: ${isLoadMore}, lastKey:`,
          lastKey
        );

        const response = await loadLibrary(
          user.userId,
          token,
          10, // limit
          "uploadDate", // sortBy
          "desc", // order
          lastKey // lastEvaluatedKey for pagination
        );

        console.log("[LIBRARY] API Response:", response);
        console.log("[LIBRARY] Response pagination:", response.pagination);

        if (response.success) {
          const newPapers = response.papers || [];
          console.log(`[LIBRARY] Received ${newPapers.length} papers`);

          if (isLoadMore && !resetPagination) {
            // Append new papers to existing ones
            setPapers((prevPapers) => {
              console.log(
                `[LIBRARY] Appending ${newPapers.length} papers to existing ${prevPapers.length}`
              );
              // Remove duplicates based on paper ID
              const existingIds = new Set(prevPapers.map((p) => p.id));
              const uniqueNewPapers = newPapers.filter(
                (p) => !existingIds.has(p.id)
              );
              console.log(
                `[LIBRARY] Adding ${uniqueNewPapers.length} unique papers`
              );
              return [...prevPapers, ...uniqueNewPapers];
            });
          } else {
            // Replace papers for initial load or refresh
            console.log(
              `[LIBRARY] Replacing papers with ${newPapers.length} new papers`
            );
            setPapers(newPapers);
          }

          // Update pagination info
          const newPaginationState = {
            hasMore: response.pagination?.hasMore || false,
            lastEvaluatedKey: response.pagination?.lastEvaluatedKey || null,
          };
          console.log("[LIBRARY] Raw pagination from API:", {
            hasMore: response.pagination?.hasMore,
            lastEvaluatedKey: response.pagination?.lastEvaluatedKey,
            lastKeyType: typeof response.pagination?.lastEvaluatedKey,
          });
          console.log(
            "[LIBRARY] Setting pagination state:",
            newPaginationState
          );
          setPagination(newPaginationState);
        } else {
          setError(response.message || "Failed to load library");
        }
      } catch (error) {
        console.error("Error loading library:", error);
        setError("Error loading library. Please try again.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [authenticated, user, navigate, pagination.lastEvaluatedKey]
  );

  // Initial load - only run when user/auth changes
  useEffect(() => {
    if (authenticated && user) {
      console.log("[LIBRARY] Initial load triggered");
      fetchPapers(true, false, true); // showLoader, isLoadMore, resetPagination
    }
  }, [authenticated, user?.userId]); // Only depend on auth and userId

  // Auto-refresh every 30 seconds if there are processing papers
  useEffect(() => {
    const hasProcessingPapers = papers.some(
      (paper) => paper.status === "processing"
    );

    if (hasProcessingPapers && authenticated && user) {
      console.log("[LIBRARY] Setting up auto-refresh for processing papers");
      const interval = setInterval(() => {
        console.log("[LIBRARY] Auto-refreshing...");
        fetchPapers(false, false, true); // Don't show loader, not load more, reset pagination
      }, 30000); // 30 seconds

      return () => {
        console.log("[LIBRARY] Cleaning up auto-refresh interval");
        clearInterval(interval);
      };
    }
  }, [papers, authenticated, user, fetchPapers]);

  // Load more papers function
  const handleLoadMore = useCallback(() => {
    console.log("[LIBRARY] Load More clicked", {
      loadingMore,
      hasMore: pagination.hasMore,
      lastKey: pagination.lastEvaluatedKey,
      lastKeyType: typeof pagination.lastEvaluatedKey,
    });

    // 조건을 더 유연하게 변경 - lastEvaluatedKey가 null이어도 hasMore가 true면 시도
    if (!loadingMore && pagination.hasMore) {
      console.log("[LIBRARY] Conditions met, calling fetchPapers");
      fetchPapers(false, true, false); // showLoader = false, isLoadMore = true, resetPagination = false
    } else {
      console.log("[LIBRARY] Conditions not met:", {
        loadingMoreBlocked: loadingMore,
        hasMoreBlocked: !pagination.hasMore,
      });
    }
  }, [
    loadingMore,
    pagination.hasMore,
    pagination.lastEvaluatedKey,
    fetchPapers,
  ]);

  // 표시할 논문들 필터링 - processing 포함, failed만 제외
  const getDisplayedPapers = () => {
    if (!papers) return [];

    // 모든 상태 표시 (failed만 제외)
    const displayed = papers.filter((paper) => {
      const status = paper.status || "unknown";
      return status !== "failed";
    });

    console.log("[LIBRARY] Displayed papers by status:", {
      total: papers.length,
      displayed: displayed.length,
      byStatus: papers.reduce((acc, paper) => {
        const status = paper.status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
    });

    return displayed;
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
    // removed star feature
  };

  // Handle paper click to navigate to BookStand
  const handlePaperClick = (paperId) => {
    const paper = papers.find((p) => p.id === paperId);

    // 완료된 논문만 BookStand로 이동 가능
    if (paper && paper.status === "completed") {
      navigate("/bookstand", {
        state: {
          paperId: paperId,
        },
      });
    } else if (paper && paper.status === "processing") {
      // Show a more informative message for processing papers
      alert(
        "This paper is still being processed. It usually takes 2-3 minutes. The page will automatically refresh to show updates."
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

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    console.log("[LIBRARY] Manual refresh triggered");
    // Reset pagination for fresh load
    setPagination({
      hasMore: false,
      lastEvaluatedKey: null,
    });
    fetchPapers(false, false, true); // showLoader = false, isLoadMore = false, resetPagination = true
  }, [fetchPapers]);

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

  // Debug pagination state
  console.log("[LIBRARY] Current state:", {
    papersCount: papers.length,
    displayedCount: displayedPapers.length,
    hasMore: pagination.hasMore,
    lastKey: pagination.lastEvaluatedKey ? "EXISTS" : "NULL",
    loading,
    loadingMore,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-500 flex flex-col">
      {/* User menu */}
      <div className="absolute top-5 right-5 z-10">
        <UserToggle
          onArchiveClick={() => {}} // Already on Archive/Library page
          onSettingClick={() => navigate("/setting")}
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

              {/* Refresh and Upload buttons */}
              <div className="flex gap-3">
                {stats.processing > 0 && !loading && (
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {refreshing ? (
                      <svg
                        className="animate-spin h-4 w-4"
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
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    )}
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </button>
                )}

                <button
                  onClick={() => navigate("/")}
                  className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 transition-colors"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Upload New Paper
                </button>
              </div>
            </div>

            {/* Statistics */}
            {stats.total > 0 && (
              <div className="flex gap-4 text-sm text-gray-600 mb-4">
                <span className="bg-green-100 px-3 py-1 rounded-full">
                  {stats.completed} Completed
                </span>
                {stats.processing > 0 && (
                  <span className="bg-blue-100 px-3 py-1 rounded-full">
                    {stats.processing} Processing
                  </span>
                )}
                <span className="bg-gray-100 px-3 py-1 rounded-full">
                  {displayedPapers.length} Total Displayed
                </span>
              </div>
            )}
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
                  <div className="flex gap-4 justify-center">
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
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayedPapers.map((paper) => (
                  <div className="flex justify-center relative" key={paper.id}>
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

              {/* Load More Button */}
              {pagination.hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
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
                        Loading More...
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 14l-7 7m0 0l-7-7m7 7V3"
                          />
                        </svg>
                        Load More Papers
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Processing papers notice */}
          {stats.processing > 0 && !loading && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 text-blue-800">
                <svg
                  className="animate-spin h-4 w-4"
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
                <span className="font-medium">
                  {stats.processing} paper
                  {stats.processing > 1 ? "s are" : " is"} currently processing
                </span>
              </div>
              <p className="text-sm text-blue-600 mt-1">
                Processing usually takes 2-3 minutes. This page automatically
                refreshes every 30 seconds.
              </p>
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
          <div className="flex items-center justify-center space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mx-auto w-fit">
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
