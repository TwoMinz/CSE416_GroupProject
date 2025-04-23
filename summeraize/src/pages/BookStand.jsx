import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PdfReader from "../components/PdfReader";
import MdFileReader from "../components/MdFileReader";
import UserToggle from "../components/UserToggle";
import { getPaperDetail, getContentUrl } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { requestPaperStatus, addListener } from "../services/websocket";

const BookStand = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authenticated, logout } = useAuth();

  const [paperId, setPaperId] = useState(null);
  const [paperDetail, setPaperDetail] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [mdContent, setMdContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);

  // Get paperId from location state
  useEffect(() => {
    const id = location.state?.paperId;
    if (id) {
      setPaperId(id);
    } else {
      // If no paperId, use a sample
      setMdContent(sampleMarkdown);
      setLoading(false);
    }
  }, [location]);

  // Load paper details and content when paperId is set
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

        // Request paper details
        const detailResponse = await getPaperDetail(paperId, token);
        setPaperDetail(detailResponse);

        // Request content URL
        const urlResponse = await getContentUrl(paperId, token);
        if (urlResponse.viewUrl) {
          setPdfUrl(urlResponse.viewUrl);
        }

        // Load the markdown summary if available
        if (detailResponse.summary) {
          setMdContent(detailResponse.summary);
        } else {
          // If no summary, show a processing message
          setMdContent(
            "# Processing paper...\n\nYour summary will appear here once processing is complete."
          );
          setProcessingStatus("processing");

          // Request status update via WebSocket
          requestPaperStatus(paperId);
        }
      } catch (error) {
        console.error("Error loading paper:", error);
        setError("Error loading paper content. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadPaperContent();
  }, [paperId, authenticated, user, navigate]);

  // Set up WebSocket listener for paper status updates
  useEffect(() => {
    if (!paperId) return;

    const unsubscribe = addListener("PAPER_STATUS_UPDATE", (data) => {
      if (data.paperId === paperId) {
        setProcessingStatus(data.status);

        // If processing is complete, reload the paper details
        if (data.status === "completed") {
          const loadUpdatedContent = async () => {
            try {
              const token = localStorage.getItem("summaraize-token");
              const detailResponse = await getPaperDetail(paperId, token);

              if (detailResponse.summary) {
                setMdContent(detailResponse.summary);
              }
            } catch (error) {
              console.error("Error reloading paper content:", error);
            }
          };

          loadUpdatedContent();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [paperId]);

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
          onSettingClick={() => console.log("Setting clicked")}
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
          {paperDetail && (
            <div className="text-white">
              <h2 className="text-xl font-semibold">
                {paperDetail.title || "Untitled Paper"}
              </h2>
            </div>
          )}
        </header>

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
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
                <PdfReader pdfUrl={pdfUrl} />
              </div>
            </div>

            {/* Summary panel */}
            <div
              className="w-full md:w-1/2 bg-white bg-opacity-90 rounded-3xl shadow-xl overflow-hidden"
              style={{ height: "85vh" }}
            >
              <div className="h-full flex flex-col">
                <div className="p-4 bg-blue-500 text-white flex justify-between items-center">
                  <h2 className="text-2xl font-semibold">AI Summary</h2>
                  {processingStatus && (
                    <div className="px-3 py-1 bg-blue-600 rounded-full text-sm">
                      {processingStatus}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <MdFileReader markdownContent={mdContent} />
                </div>
              </div>
            </div>
          </div>
        )}
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
