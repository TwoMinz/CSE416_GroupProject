import React, { useState, useEffect } from 'react';
import PdfReader from '../components/PdfReader';
import MdFileReader from '../components/MdFileReader';
import UserToggle from '../components/UserToggle';
import { useNavigate } from 'react-router-dom';

const BookStand = () => {
  const navigate = useNavigate();
  const handleGoToHome = () => {
    navigate('/');
  };
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
      {/* 상단 사용자 메뉴 */}
      <div className="absolute top-5 right-5 z-10">
        <UserToggle 
          onArchiveClick={''}
          onSettingClick={''}
          onLogoutClick={''}
        />
      </div>
      
      <div className="max-w-7xl mx-auto">
        {/* Header with app name */}
        <header className="flex justify-between items-center mb-6">
          <h1 
          className="text-2xl font-bold text-white drop-shadow-sm"
            onClick={handleGoToHome}
            style={{ cursor: 'pointer' }}>
            SummarAIze
            </h1>
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
          <div className="w-full md:w-1/2 bg-white bg-opacity-90 rounded-3xl shadow-xl overflow-hidden" style={{ height: '85vh' }}>
            {/* 고정 높이로 변경 (h-1/2 제거) */}
            <div className="h-full flex flex-col">
              <div className="p-4 bg-blue-500 text-white">
                <h2 className="text-2xl font-semibold">AI Summary</h2>
              </div>
              <div className="flex-1 overflow-hidden">
                {/* flex-1로 나머지 공간 차지하도록 설정 */}
                <MdFileReader markdownContent={mdContent} />
              </div>
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

## Spiking Neural Networks: A Biologically Inspired Approach

### Architecture
- SNNs consist of spiking neurons and synapses with adjustable scalar weights. (p.3)
- The first step is encoding analog input data into spike trains using rate-based, temporal, or population coding. (p.3)
- Spiking neurons generate action potentials when membrane potential crosses a threshold. (p.3)
- Hodgkin and Huxley created the first model of action potential generation from voltage gating properties. (p.3)
- The Leaky Integrate-and-Fire (LIF) model is popular for its simplicity and intuitive properties. (p.3-4)
- Synapses can be excitatory (increasing membrane potential) or inhibitory (decreasing it). (p.4)
- Synaptic strengths change as a result of learning. (p.4)

## Learning Rules in SNNs

### Unsupervised Learning via STDP
- Spike-Timing-Dependent Plasticity (STDP) is a bio-plausible learning rule for SNNs. (p.4)
- If a presynaptic neuron fires briefly (≈10 ms) before a postsynaptic neuron, the connecting weight is strengthened. (p.4)
- If the presynaptic neuron fires after the postsynaptic neuron, the weight is weakened. (p.4)
- Strengthening is called long-term potentiation (LTP) and weakening is called long-term depression (LTD). (p.4)
- STDP makes neurons responsive to repeated spike patterns and reduces postsynaptic latency. (p.4)
- STDP can detect repeating spatio-temporal patterns and focus on afferents that consistently fire early. (p.4)
- The STDP rule focuses on the first spikes which contain most information needed for pattern recognition. (p.4)

### Probabilistic Characterization of Unsupervised STDP
- Evidence suggests Bayesian analysis of sensory stimuli occurs in the brain. (p.4-5)
- Nessler et al. showed that STDP in winner-take-all circuits approximates expectation maximization (EM). (p.4-5)
- STDP can implement stochastic online EM algorithms for multinomial mixture distributions. (p.5)
- This approach has been used for spatio-temporal pattern recognition and spoken word classification. (p.5)
- Probabilistic learning in spiking neurons has been used for modeling hidden causes and sequential data processing. (p.5)

### Supervised Learning
- Supervised learning adjusts weights to minimize error between desired and output spike trains. (p.5-6)
- Backpropagation in SNNs faces two issues: non-differentiable spike functions and the "weight transport" problem. (p.5)
- The weight transport problem requires symmetric feedback weights that project accurately to correct neurons. (p.5)
- Progress has been made using random feedback weights for simpler problems. (p.6)
- SpikeProp was the first algorithm to train SNNs by backpropagating errors using spike timing in cost function. (p.6)
- ReSuMe (remote supervised learning) adapts the Widrow-Hoff rule for spiking neurons using STDP and anti-STDP. (p.6)
- The Chronotron uses the Victor-Purpora distance metric between spike trains for supervised training. (p.6)
- SPAN converts spike trains to analog values using alpha kernels for compatibility with traditional learning rules. (p.6-7)
- Recent approaches use surrogate derivatives to overcome the non-differentiability of spike functions. (p.7)

## Deep Learning in SNNs

### Deep, Fully Connected SNNs
- Recent studies have developed deep SNNs using STDP and stochastic gradient descent. (p.7-8)
- Diehl et al. showed STDP in a two-layer SNN can extract discriminative features from MNIST with 95% accuracy. (p.8)
- Bengio et al. proposed deep learning using forward and backward neural activity propagation. (p.8)
- O'Connor and Welling developed backpropagation using outer products of spike counts, achieving 97.93% on MNIST. (p.8)
- Lee et al. used membrane potential as differentiable signals for backpropagation, achieving 98.88% on MNIST. (p.8)
- Neftci et al. proposed event-driven random backpropagation (eRBP) to simplify the backpropagation chain path. (p.9)
- ANN-to-SNN conversion is a direct approach to utilize pre-trained networks in neuromorphic platforms. (p.9)
- Rate-based coding is generally used to replace floating-point activations with spike rates. (p.9)
- Converted SNNs have achieved excellent accuracy while requiring fewer operations than traditional ANNs. (p.9)

### Spiking CNNs
- Convolutional Neural Networks (CNNs) consist of convolution and pooling layers followed by a classifier. (p.9-10)
- The first layer of convolution extracts primary visual features similar to oriented-edge detectors in V1. (p.9-10)
- Pooling layers perform subsampling to reduce size and develop invariance to changes in orientation, scale, and translation. (p.10)
- Spiking CNNs can use hand-crafted filters (like Difference-of-Gaussian) or learned representations. (p.10)
- Tavanaei et al. used SAILnet to train orientation selective kernels for the initial layer of a spiking CNN. (p.10)
- Layer-wise spiking convolutional autoencoders achieved 99.05% on MNIST, comparable to traditional CNNs. (p.10)
- Lee et al. developed end-to-end gradient descent learning for spiking CNNs using membrane potential. (p.10)
- Converting pre-trained CNNs to spiking architecture has shown high performance with fewer operations. (p.10-11)
- Rueckauer et al. proposed conversion criteria for spiking CNNs to recognize CIFAR-10 and ImageNet datasets. (p.10-11)

### Spiking Deep Belief Networks
- Deep Belief Networks (DBNs) use greedy layer-wise learning of stacked Restricted Boltzmann Machines (RBMs). (p.12)
- RBMs use stochastic binary units and are trained by contrastive divergence (CD). (p.12)
- Lee et al. implemented sparse DBNs to model cortical visual areas V1 and V2. (p.12)
- Spiking RBMs use stochastic integrate-and-fire neurons instead of memoryless stochastic units. (p.12)
- Neftci et al. showed that STDP can approximate contrastive divergence in a spiking network. (p.12)
- O'Connor et al. introduced the first spiking DBN by converting a trained DBN to a network of LIF neurons. (p.12)
- Spiking DBNs and RBMs are power-efficient and suitable for hardware implementation. (p.12-13)
- There is an equivalence between hybrid Boltzmann machines and Hopfield networks. (p.12-13)

### Recurrent SNNs
- Gated recurrent networks like LSTMs have replaced traditional RNNs for processing temporal information. (p.13)
- LSTM cells contain state and gates controlled by trainable weights. (p.13)
- Shrestha et al. implemented a spiking LSTM on the IBM TrueNorth neurosynaptic system. (p.13-14)
- They used two channels of spike trains to represent positive and negative values. (p.14)
- The phased LSTM is well-suited to process event-driven, asynchronously sampled data. (p.14)
- Reservoir models like Liquid State Machines (LSMs) use recurrent SNNs to transform spike trains into representations. (p.14)
- The NeuCube is a 3D reservoir of spiking neurons intended to reflect connectivity of the human neocortex. (p.14)
- LSNN architecture (long short-term memory SNNs) achieved performance comparable to LSTMs on sequential tasks. (p.14)

## Performance Comparisons
- Deep SNNs follow two tracks: online learning and offline learning (conversion from ANNs). (p.15)
- Conversion methods generally achieve higher accuracy but avoid direct training of multi-layer SNNs. (p.15)
- Online learning offers multi-layer learning but typically reports lower accuracy rates. (p.15)
- Spiking CNNs have higher accuracy than fully connected SNNs and spiking DBNs on image classification. (p.15)
- Current state-of-the-art models achieve accuracy close to traditional deep learning methods. (p.15-16)

## Summary
- Deep SNNs combine the effectiveness of deep learning with the power efficiency of spike-based communication. (p.15)
- Challenges include developing appropriate learning rules for spatio-temporal spike patterns. (p.15)
- Spike-based deep learning methods can perform as well as traditional DNNs while being more power-efficient. (p.15)
- Both supervised approaches (like backpropagation with surrogate gradients) and unsupervised approaches (like STDP) show promise. (p.15)
- Future research will likely bridge the gap between computational efficiency and biological plausibility. (p.15)

## Citations

### MLA Format
Tavanaei, Amirhossein, et al. "Deep Learning in Spiking Neural Networks." Neural Networks, 2019. arXiv:1804.08150v4.

### APA Format
Tavanaei, A., Ghodrati, M., Kheradpisheh, S. R., Masquelier, T., & Maida, A. (2019). Deep learning in spiking neural networks. Neural Networks. https://arxiv.org/abs/1804.08150v4
`;

export default BookStand;