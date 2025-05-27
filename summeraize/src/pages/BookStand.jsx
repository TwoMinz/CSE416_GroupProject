import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SimplePdfReader from "../components/PdfReader";
import MdFileReader from "../components/MdFileReader";
import UserToggle from "../components/UserToggle";
import { getContentUrl } from "../services/api";
import { useAuth } from "../context/AuthContext";

const BookStand = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authenticated, logout } = useAuth();

  const [paperId, setPaperId] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [summaryUrl, setSummaryUrl] = useState(null);
  const [mdContent, setMdContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [urlRefreshCount, setUrlRefreshCount] = useState(0);

  // URL 갱신 함수
  const refreshContentUrls = useCallback(async () => {
    if (!paperId || !user || !authenticated) return;

    try {
      console.log("Refreshing content URLs due to expiration...");
      const token = localStorage.getItem("summaraize-token");
      const urlResponse = await getContentUrl(paperId, token);

      if (urlResponse.pdfUrl) {
        console.log("PDF URL refreshed");
        setPdfUrl(urlResponse.pdfUrl);
      }

      if (urlResponse.summaryUrl) {
        console.log("Summary URL refreshed");
        setSummaryUrl(urlResponse.summaryUrl);
      }

      setUrlRefreshCount((prev) => prev + 1);
    } catch (error) {
      console.error("Error refreshing content URLs:", error);
      setError("Failed to refresh content URLs. Please try again.");
    }
  }, [paperId, user, authenticated]);

  // Helper function to refresh content for papers still in processing
  const refreshContent = useCallback(
    async (id, token) => {
      if (!id || !token || processingStatus === "completed") return;

      try {
        console.log("Refreshing content for paper:", id);
        const urlResponse = await getContentUrl(id, token);

        if (urlResponse.summaryUrl) {
          console.log("Summary now available");
          setSummaryUrl(urlResponse.summaryUrl);
          setProcessingStatus("completed");
        }
      } catch (error) {
        console.error("Error refreshing content:", error);
      }
    },
    [processingStatus]
  );

  // Get paperId from location state
  useEffect(() => {
    // Check for paperId in location state
    if (location.state && location.state.paperId) {
      const id = location.state.paperId;
      console.log("Paper ID from location state:", id);
      setPaperId(id);
    } else {
      console.log("No paper ID in location state, using sample content");
      setMdContent(sampleMarkdown);
      setLoading(false);
    }
  }, [location]);

  // Load paper content when paperId is set
  useEffect(() => {
    if (!authenticated || !user) {
      navigate("/login");
      return;
    }

    if (!paperId) return;

    const loadPaperContent = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("summaraize-token");
        console.log("Loading paper content for ID:", paperId);

        const urlResponse = await getContentUrl(paperId, token);
        console.log("Content URLs response:", urlResponse);

        if (urlResponse.pdfUrl) {
          console.log("PDF URL received");
          setPdfUrl(urlResponse.pdfUrl);

          // URL 만료 시간 추적 (1시간 45분 후 자동 갱신)
          setTimeout(() => {
            console.log("PDF URL will expire soon, refreshing...");
            refreshContentUrls();
          }, 105 * 60 * 1000); // 1시간 45분
        }

        if (urlResponse.summaryUrl) {
          console.log("Summary URL received");
          setSummaryUrl(urlResponse.summaryUrl);
          setProcessingStatus("completed");
        } else {
          console.log("No summary URL available, showing processing message");
          setMdContent(
            "# Paper is still processing\n\nThis paper is still being processed. The summary will be available once processing is complete.\n\nPlease check back later or refresh this page."
          );
          setProcessingStatus("processing");

          setTimeout(() => {
            refreshContent(paperId, token);
          }, 10000);
        }
      } catch (error) {
        console.error("Error loading paper:", error);
        setError("Error loading paper content. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadPaperContent();
  }, [
    paperId,
    authenticated,
    user,
    navigate,
    urlRefreshCount,
    refreshContentUrls,
    refreshContent,
  ]);

  const handleGoToHome = () => {
    navigate("/");
  };

  const handleLogoutClick = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      {/* User menu */}
      <div className="absolute top-5 right-5 z-10">
        <UserToggle
          onArchiveClick={() => navigate("/library")}
          onSettingClick={() => navigate("/setting")}
          onLogoutClick={handleLogoutClick}
        />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header with app name */}
        <header className="flex justify-between items-center mb-6">
          <h1
            className="text-2xl font-bold text-white drop-shadow-sm cursor-pointer"
            onClick={handleGoToHome}
          >
            SummarAIze
          </h1>
        </header>

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
            <div className="ml-4 text-blue-500 font-semibold">
              {processingStatus
                ? `Processing: ${processingStatus}`
                : "Loading..."}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Main content area with reader panels */}
        {!loading && !error && (
          <div className="flex flex-col md:flex-row gap-6 min-h-[80vh]">
            {/* PDF panel */}
            <div className="w-full md:w-1/2 bg-white bg-opacity-90 rounded-3xl shadow-xl overflow-hidden">
              <div className="h-full">
                <SimplePdfReader
                  pdfUrl={pdfUrl}
                  onUrlExpired={refreshContentUrls}
                />
              </div>
            </div>

            {/* Summary panel */}
            <div
              className="w-full md:w-1/2 bg-white bg-opacity-90 rounded-3xl shadow-xl overflow-hidden"
              style={{ height: "85vh" }}
            >
              <div className="h-full flex flex-col">
                {/* Header with processing status badge */}
                <div className="p-4 bg-blue-500 text-white">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Summary</h2>

                    {/* Processing status badge */}
                    {processingStatus && processingStatus !== "completed" && (
                      <div className="px-3 py-1 bg-blue-600 rounded-full text-sm flex items-center">
                        <div className="w-2 h-2 rounded-full bg-white mr-2 animate-pulse"></div>
                        {processingStatus}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content display with markdown renderer */}
                <div className="flex-1 overflow-hidden">
                  {summaryUrl ? (
                    <MdFileReader markdownUrl={summaryUrl} />
                  ) : (
                    <MdFileReader markdownContent={mdContent} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="w-full mt-auto pt-5 text-center text-white">
        <p className="text-sm opacity-80">
          Please be aware that SummarAIze can make mistakes.
        </p>
      </div>
    </div>
  );
};

// Sample markdown content for demonstration
const sampleMarkdown = `
# Summary of "Deep Learning in Spiking Neural Networks"

## Abstract
- Deep learning has revolutionized machine learning, especially for computer vision tasks. (p.1)
- Artificial neural networks (ANNs) use continuous-valued activations and backpropagation, requiring vast amounts of labeled data. (p.1)
- Spiking neural networks (SNNs) are more biologically realistic, using discrete spikes to compute and transmit information. (p.1)
- SNNs are more hardware-friendly and energy-efficient than ANNs, making them appealing for portable devices. (p.1)
- Training deep SNNs remains challenging as spiking neurons' transfer functions are usually non-differentiable. (p.1)
- The paper reviews supervised and unsupervised methods to train deep SNNs, comparing them for accuracy, computational cost, and hardware friendliness. (p.1)

## Introduction
- Traditional ANNs use idealized computing units with continuous activation values. (p.1)
- AlexNet's success in 2012 was a landmark for deep neural networks (DNNs) with 8 layers and 60 million parameters. (p.1)
- DNNs have been successful in many applications including image recognition, object detection, speech recognition, and biomedicine. (p.1-2)
- In the brain, neurons communicate via spike trains that are sparse in time with uniform amplitude. (p.2)
- Spikes are approximately 100 mV with width about 1 msec, and information is conveyed by their timing and rates. (p.2)
- SNNs have been applied to vision processing, speech recognition, and medical diagnosis applications. (p.2)
- The precise timing of spikes is highly reliable in several brain areas, suggesting an important role in neural coding. (p.2)
- SNNs offer energy efficiency due to sparsity of spike events in time. (p.2)
- Deep SNNs combine the multilayer structure of DNNs with the spike-based communication of biological neurons. (p.2-3)
- Deep spiking networks can help understand neural computation and implement energy-efficient hardware. (p.3)

# Citations

### MLA Format
Tavanaei, Amirhossein, et al. "Deep Learning in Spiking Neural Networks." Neural Networks, 2019. arXiv:1804.08150v4.

### APA Format
Tavanaei, A., Ghodrati, M., Kheradpisheh, S. R., Masquelier, T., & Maida, A. (2019). Deep learning in spiking neural networks. Neural Networks. https://arxiv.org/abs/1804.08150v4
`;

export default BookStand;
