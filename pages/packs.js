import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import Card from '../components/Card';
import CardModal from '../components/CardModal';
import { getPackInfo, openPack, openAllPacks, TIER_NAMES } from '../lib/api';

export default function Packs({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const [packInfo, setPackInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [openedCards, setOpenedCards] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [revealIndex, setRevealIndex] = useState(-1);
  const [selectedCard, setSelectedCard] = useState(null);
  
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    loadPackInfo();
  }, [user, router]);
  
  const loadPackInfo = async () => {
    try {
      const data = await getPackInfo();
      setPackInfo(data);
    } catch (err) {
      console.error('Failed to load pack info:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenPack = async () => {
    if (!packInfo || packInfo.packsRemaining <= 0) return;
    
    setOpening(true);
    setShowResults(false);
    setOpenedCards([]);
    setRevealIndex(-1);
    
    try {
      const data = await openPack();
      setOpenedCards(data.cards);
      setShowResults(true);
      
      // Reveal cards one by one
      for (let i = 0; i < data.cards.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setRevealIndex(i);
      }
      
      // Reload pack info
      loadPackInfo();
    } catch (err) {
      console.error('Failed to open pack:', err);
      alert(err.message);
    } finally {
      setOpening(false);
    }
  };
  
  const handleOpenAll = async () => {
    if (!packInfo || packInfo.packsRemaining <= 0) return;
    
    if (!confirm(`Open all ${packInfo.packsRemaining} packs at once?`)) return;
    
    setOpening(true);
    setShowResults(false);
    setOpenedCards([]);
    setRevealIndex(-1);
    
    try {
      const data = await openAllPacks();
      setOpenedCards(data.cards);
      setShowResults(true);
      setRevealIndex(data.cards.length - 1); // Show all at once
      
      // Reload pack info
      loadPackInfo();
    } catch (err) {
      console.error('Failed to open packs:', err);
      alert(err.message);
    } finally {
      setOpening(false);
    }
  };
  
  const bestCard = openedCards.length > 0 
    ? openedCards.reduce((best, card) => card.tier > best.tier ? card : best, openedCards[0])
    : null;
  
  if (!user) return null;
  
  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Open Packs</h1>
          <p className="text-gray-400">
            {packInfo && packInfo.packsRemaining > 0
              ? `You have ${packInfo.packsRemaining} packs remaining`
              : 'No packs remaining'}
          </p>
        </div>
        
        {/* Pack Status */}
        {!loading && packInfo && (
          <div className="max-w-md mx-auto bg-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400">Packs Opened</span>
              <span className="text-white font-bold">{packInfo.packsOpened} / {packInfo.maxPacks}</span>
            </div>
            
            {/* Progress Bar */}
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden mb-6">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                style={{ width: `${(packInfo.packsOpened / packInfo.maxPacks) * 100}%` }}
              />
            </div>
            
            {/* Pack Types */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className={`p-3 rounded-lg ${packInfo.packsOpened < 3 ? 'bg-green-900/30 border border-green-600/30' : 'bg-gray-700'}`}>
                <div className="text-sm text-gray-400">Starter Packs</div>
                <div className="text-xl font-bold text-white">{Math.min(packInfo.packsOpened, 3)} / 3</div>
                <div className="text-xs text-gray-500">Guaranteed positions</div>
              </div>
              <div className={`p-3 rounded-lg ${packInfo.packsOpened >= 3 && packInfo.packsOpened < 8 ? 'bg-purple-900/30 border border-purple-600/30' : 'bg-gray-700'}`}>
                <div className="text-sm text-gray-400">Bonus Packs</div>
                <div className="text-xl font-bold text-white">{Math.max(0, packInfo.packsOpened - 3)} / 5</div>
                <div className="text-xs text-gray-500">Random players</div>
              </div>
            </div>
            
            {/* Buttons */}
            {packInfo.packsRemaining > 0 ? (
              <div className="space-y-3">
                <button
                  onClick={handleOpenPack}
                  disabled={opening}
                  className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all disabled:opacity-50 text-lg"
                >
                  {opening ? 'Opening...' : 'Open 1 Pack'}
                </button>
                
                {packInfo.packsRemaining > 1 && (
                  <button
                    onClick={handleOpenAll}
                    disabled={opening}
                    className="w-full py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    Open All ({packInfo.packsRemaining} packs)
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-400 mb-4">You've opened all your packs!</p>
                <button
                  onClick={() => router.push('/cards')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Your Cards
                </button>
              </div>
            )}
            
            {/* Tier Rates */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="text-xs text-gray-500 mb-2">Drop Rates</div>
              <div className="grid grid-cols-5 gap-1 text-xs">
                {[10, 9, 8, 7, 6].map(tier => (
                  <div key={tier} className="text-center">
                    <div style={{ color: `var(--tier-${tier})` }}>T{tier}</div>
                    <div className="text-gray-500">{packInfo.tierRates?.[tier] || '?'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Opened Cards */}
        {showResults && openedCards.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                {openedCards.length <= 5 ? 'Pack Opened!' : `${Math.ceil(openedCards.length / 5)} Packs Opened!`}
              </h2>
              {bestCard && bestCard.tier >= 7 && (
                <p className="text-lg" style={{ color: `var(--tier-${bestCard.tier})` }}>
                  You got a {TIER_NAMES[bestCard.tier]}!
                </p>
              )}
              <p className="text-sm text-gray-400 mt-2">Tap any card to view details</p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4">
              {openedCards.map((card, index) => (
                <div
                  key={card.id}
                  className={`transition-all duration-500 cursor-pointer ${
                    index <= revealIndex 
                      ? 'opacity-100 transform scale-100' 
                      : 'opacity-0 transform scale-75'
                  }`}
                  onClick={() => index <= revealIndex && setSelectedCard(card)}
                >
                  <Card card={card} small={openedCards.length > 10} />
                </div>
              ))}
            </div>
            
            <div className="text-center mt-6 space-x-4">
              <button
                onClick={() => router.push('/cards')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Collection
              </button>
              <button
                onClick={() => {
                  setShowResults(false);
                  setOpenedCards([]);
                }}
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                {packInfo?.packsRemaining > 0 ? 'Open Another Pack' : 'Done'}
              </button>
            </div>
          </div>
        )}
        
        {/* Card Modal */}
        {selectedCard && (
          <CardModal 
            card={selectedCard} 
            onClose={() => setSelectedCard(null)} 
          />
        )}
      </div>
    </Layout>
  );
}
