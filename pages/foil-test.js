import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import FoilPackOpening from '../components/FoilPackOpening';

export default function FoilTest() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [cards, setCards] = useState([]);

  useEffect(() => {
    // Only allow local dev
    if (process.env.NODE_ENV !== 'development') {
      router.replace('/');
    }
  }, [router]);

  const handleStart = () => {
    const mockCards = [
      {
        id: 1,
        player_name: 'Test Player',
        player: 'Test Player',
        season: 1999,
        team: 'TEST',
        position: 'QB',
        tier: 8,
        composite_score: 92,
        stats: { 'Pass Yds': 4023, 'Pass TD': 31 },
        image_url: '/cards/placeholder.svg',
      },
    ];
    setCards(mockCards);
    setIsOpen(true);
  };

  const handleComplete = () => {
    setIsOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-6">
      <FoilPackOpening
        isOpen={isOpen}
        onComplete={handleComplete}
        packType="bonus"
        cards={cards}
      />
      {!isOpen && (
        <div className="text-center bg-gray-800 rounded-xl p-8 shadow-2xl max-w-md w-full">
          <div className="text-4xl mb-3">🏈</div>
          <h1 className="text-2xl font-bold text-white mb-2">Foil Pack Test</h1>
          <p className="text-gray-400 text-sm mb-6">
            Local-only test page for the foil opening animation.
          </p>
          <button
            onClick={handleStart}
            className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all"
          >
            Start Foil Animation
          </button>
          <p className="text-xs text-gray-500 mt-4">
            Visit http://localhost:3000/foil-test (testing only)
          </p>
        </div>
      )}
    </div>
  );
}
