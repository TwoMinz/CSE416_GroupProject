import React, { useState, useEffect } from 'react';
import PdfReader from '../components/PdfReader';
import MdFileReader from '../components/MdFileReader';

const BookStand = () => {
  // 실제 구현에서는 파일을 불러오거나 API에서 데이터를 가져옵니다
  // 여기서는 예시 데이터를 사용합니다
  const [pdfFile, setPdfFile] = useState(null);
  const [mdContent, setMdContent] = useState('');
  
  useEffect(() => {
    // 여기에서 실제 파일이나 API 데이터를 불러옵니다
    // 예시 데이터 설정
    setPdfFile('/sample-paper.pdf');
    setMdContent(sampleMarkdown);
  }, []);

  return (
    <div className="flex h-screen">
      {/* 왼쪽 PDF 뷰어 (화면의 절반) */}
      <div className="w-1/2 border-r border-gray-300">
        <PdfReader pdfFile={pdfFile} />
      </div>
      
      {/* 오른쪽 마크다운 뷰어 (화면의 절반) */}
      <div className="w-1/2">
        <MdFileReader markdownContent={mdContent} />
      </div>
    </div>
  );
};

// 예시 마크다운 콘텐츠
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