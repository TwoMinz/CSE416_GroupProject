import React from 'react';
import { useNavigate } from 'react-router-dom';
import PaperCard from '../components/PaperCard';
import UserToggle from '../components/UserToggle';

const Library = () => {
  const navigate = useNavigate();
  const handleClickWebLogo = () => {
    navigate('/');
  }

  // 간단한 더미 데이터
  const papers = [
    {
      id: 1,
      title: 'Untitled.pdf',
      date: '16 March, 2025',
      time: '16:39',
      starred: true
    },
    {
      id: 2,
      title: 'Untitled_2.pdf',
      date: '4 March, 2025',
      time: '13:46',
      starred: false
    }
    // 필요시 더 추가
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-500 flex flex-col">
      
      {/* 상단 사용자 메뉴 */}
      <div className="absolute top-5 right-5 z-10">
        <UserToggle 
          //onArchiveClick={() => console.log('Archive clicked')}
          //onSettingClick={() => console.log('Setting clicked')}
          //onLogoutClick={() => console.log('Logout clicked')}
        />
      </div>
      
      {/* 컨텐츠 영역 - 화면 중앙에 배치 */}
      <div className="flex-1 flex justify-center items-center">
        {/* 투명한 하얀 배경의 둥근 컨테이너 - 세련된 스크롤 */}
        <div 
          className="bg-white bg-opacity-60 rounded-3xl p-8 backdrop-blur-sm shadow-lg w-5/6 max-w-6xl mx-auto my-16 overflow-y-auto"
          style={{ 
            height: 'calc(100vh - 200px)',
            width: '95%',
            scrollbarWidth: 'none', /* Firefox */
          }}
        >
          {/* Firefox, IE, Edge용 스크롤바 숨김 위에서 적용됨 */}
          {/* Chrome, Safari, Opera용 스크롤바 숨김 */}
          <style>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {/* 라이브러리 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {papers.map(paper => (
              <div className="flex justify-center" key={paper.id}>
                <PaperCard 
                  key={paper.id}
                  paper={paper}
                  onToggleStar={() => console.log('Star toggled for', paper.id)}
                  onClick={() => console.log('Paper clicked', paper.id)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* 하단 앱 이름 */}
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