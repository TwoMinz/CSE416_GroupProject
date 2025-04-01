import React, { useState, useEffect } from 'react';
import PdfReader from '../components/PdfReader';
import MdFileReader from '../components/MdFileReader';
// import testPdf from '../assets/resources/test.pdf';

const BookStand = () => {
  // PDF 파일 경로를 public 폴더 기준으로 설정
  const [pdfFile, setPdfFile] = useState(null);
  const [mdContent, setMdContent] = useState('');
  
  useEffect(() => {
    // public 폴더에 있는 PDF 파일 경로 사용 (상대 경로)
    setPdfFile('/sample-paper.pdf');
    setMdContent(sampleMarkdown);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-400 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with app name */}
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white drop-shadow-sm">SummarAIze</h1>
          <div className="flex space-x-4">
            {/* Additional controls could go here */}
          </div>
        </header>

        {/* Main content area with reader panels */}
        <div className="flex flex-col md:flex-row gap-6 min-h-[80vh]">
          {/* PDF panel */}
          <div className="w-full md:w-1/2 bg-white bg-opacity-90 rounded-3xl shadow-xl overflow-hidden">
            <div className="h-full">
              <PdfReader pdfFile={pdfFile} />
            </div>
          </div>
          
          {/* Summary panel */}
          <div className="w-full md:w-1/2 bg-white bg-opacity-90 rounded-3xl shadow-xl overflow-hidden">
            <div className="h-full">
              <div className="p-4 bg-blue-500 text-white">
                <h2 className="text-xl font-semibold">AI Summary</h2>
              </div>
              <MdFileReader markdownContent={mdContent} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sample markdown content for demonstration
const sampleMarkdown = `
# Summary of "Deep Learning in Spiking Neural Networks"

## Abstract (p.1)
- Deep learning has significantly improved machine learning, especially in computer vision.
- Artificial neural networks (ANNs) use continuous activation functions and backpropagation for training, resulting in large labeled datasets. (p.1)
- Spiking neural networks (SNNs) are biologically plausible and energy-efficient but difficult to train due to non-differentiable transfer functions. (p.1)
- The review compares supervised and unsupervised training methods for deep SNNs in terms of accuracy, computational cost, and hardware efficiency. (p.1)

## Introduction (p.1-3)
- ANNs consist of neurons with continuous activation functions, enabling gradient-based learning. (p.1)
- The success of AlexNet in 2012 sparked interest in deep learning for various applications such as image recognition, speech recognition, and biomedical research. (p.1-2)
- SNNs differ fundamentally from biological brains, which communicate via discrete spikes rather than continuous values. (p.2)
- SNNs offer energy efficiency due to their sparse, event-driven computations. (p.2-3)
- Deep SNNs attempt to combine the hierarchical processing of DNNs with the spike-based nature of SNNs. (p.3)
- Training deep SNNs is still in its early stages but is important for both scientific understanding and engineering applications. (p.3)

## Spiking Neural Networks: A Biologically Inspired Approach (p.3-4)

### Architecture (p.3)
- SNNs consist of spiking neurons and synapses with adaptable weights. (p.3)
`;

export default BookStand;