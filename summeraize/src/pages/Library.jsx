import React from 'react';
import PaperCard from '../components/PaperCard';
import UserToggle from '../components/UserToggle';

const Library = () => {
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
          onArchiveClick={() => console.log('Archive clicked')}
          onSettingClick={() => console.log('Setting clicked')}
          onLogoutClick={() => console.log('Logout clicked')}
        />
      </div>
      
      {/* 컨텐츠 영역 - 화면 중앙에 배치 */}
      <div className="flex-1 flex justify-center items-center">
        {/* 투명한 하얀 배경의 둥근 컨테이너 - 세련된 스크롤 */}
        <div 
          className="bg-white bg-opacity-60 rounded-3xl p-8 backdrop-blur-sm shadow-lg w-4/5 max-w-6xl mx-auto my-16 overflow-y-auto"
          style={{ 
            height: 'calc(100vh - 150px)',
            scrollbarWidth: 'none' /* Firefox */
          }}
        >
          {/* Firefox, IE, Edge용 스크롤바 숨김 위에서 적용됨 */}
          {/* Chrome, Safari, Opera용 스크롤바 숨김 */}
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {/* 라이브러리 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {papers.map(paper => (
              <PaperCard 
                key={paper.id}
                paper={paper}
                onToggleStar={() => console.log('Star toggled for', paper.id)}
                onClick={() => console.log('Paper clicked', paper.id)}
              />
            ))}
            {/* 더 많은 카드 추가하여 스크롤 확인 가능하게 함 */}
            {[...Array(8)].map((_, index) => (
              <PaperCard 
                key={papers.length + index}
                paper={{
                  id: papers.length + index,
                  title: `Sample Paper ${index + 1}.pdf`,
                  date: '10 March, 2025',
                  time: '14:30',
                  starred: index % 3 === 0
                }}
                onToggleStar={() => console.log('Star toggled for', papers.length + index)}
                onClick={() => console.log('Paper clicked', papers.length + index)}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* 하단 앱 이름 */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-white">SummarAIze</h2>
      </div>
    </div>
  );
};

export default Library;