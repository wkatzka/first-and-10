import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Card from './Card';
import CardModal from './CardModal';
import FoilPackOpening from './FoilPackOpening';
import { getPackInfo, getCards, openPack, openSinglePack, openAllPacks, TIER_NAMES } from '../lib/api';

/**
 * Packs UI: Simplified field view with pack and best card.
 * Used by pages/packs.js (standalone) and pages/cards.js (under "Packs" tab).
 * When on Cards page, pass onViewCollection to switch to Collection tab instead of navigating.
 */
export default function PacksContent({ user, onViewCollection }) {
  const router = useRouter();
  const [packInfo, setPackInfo] = useState(null);
  const [bestCard, setBestCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [openedCards, setOpenedCards] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [revealIndex, setRevealIndex] = useState(-1);
  const [selectedCard, setSelectedCard] = useState(null);
  const [imagesGenerating, setImagesGenerating] = useState(false);
  const [showAiPopup, setShowAiPopup] = useState(false);
  const [showPackAnimation, setShowPackAnimation] = useState(false);
  const [pendingPackData, setPendingPackData] = useState(null);
  const [currentPackType, setCurrentPackType] = useState('starter');

  useEffect(() => {
    if (!user) return;
    loadPackInfo();
    loadBestCard();
  }, [user]);

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

  const loadBestCard = async () => {
    try {
      const data = await getCards();
      if (data.cards && data.cards.length > 0) {
        // Find the highest tier card (most valuable)
        const best = data.cards.reduce((best, card) => 
          card.tier > best.tier ? card : best, data.cards[0]);
        setBestCard(best);
      }
    } catch (err) {
      console.error('Failed to load cards:', err);
    }
  };

  const handleOpenPack = async () => {
    if (!packInfo || packInfo.packsRemaining <= 0) return;
    setOpening(true);
    setShowResults(false);
    setOpenedCards([]);
    setRevealIndex(-1);
    setImagesGenerating(false);
    const isStarter = packInfo.packsOpened < 3;
    setCurrentPackType(isStarter ? 'starter' : 'bonus');
    try {
      const data = await openPack();
      setPendingPackData(data);
      setOpenedCards(data.cards);
      setImagesGenerating(data.imagesGenerating || false);
      setShowPackAnimation(true);
    } catch (err) {
      console.error('Failed to open pack:', err);
      alert(err.message);
      setOpening(false);
    }
  };

  const handleOpenSinglePack = async () => {
    if (!packInfo || packInfo.packsRemaining <= 0) return;
    setOpening(true);
    setShowResults(false);
    setOpenedCards([]);
    setRevealIndex(-1);
    setImagesGenerating(false);
    setCurrentPackType('bonus');
    try {
      const data = await openSinglePack();
      setPendingPackData(data);
      setOpenedCards(data.cards);
      setImagesGenerating(data.imagesGenerating || false);
      setShowPackAnimation(true);
    } catch (err) {
      console.error('Failed to open single pack:', err);
      alert(err.message);
      setOpening(false);
    }
  };

  const handleAnimationComplete = async () => {
    setShowPackAnimation(false);
    setPendingPackData(null);
    setShowResults(true);
    setRevealIndex(openedCards.length - 1);
    if (imagesGenerating) setShowAiPopup(true);
    loadPackInfo();
    setOpening(false);
  };

  const handleOpenAll = async () => {
    if (!packInfo || packInfo.packsRemaining <= 0) return;
    if (!confirm(`Open all ${packInfo.packsRemaining} packs at once?`)) return;
    setOpening(true);
    setShowResults(false);
    setOpenedCards([]);
    setRevealIndex(-1);
    setImagesGenerating(false);
    try {
      const data = await openAllPacks();
      setOpenedCards(data.cards);
      setShowResults(true);
      setRevealIndex(data.cards.length - 1);
      setImagesGenerating(data.imagesGenerating || false);
      if (data.imagesGenerating) setShowAiPopup(true);
      loadPackInfo();
    } catch (err) {
      console.error('Failed to open packs:', err);
      alert(err.message);
    } finally {
      setOpening(false);
    }
  };

  const goToCollection = () => {
    if (onViewCollection) onViewCollection();
    else router.push('/cards');
  };

  const openedBestCard = openedCards.length > 0
    ? openedCards.reduce((best, card) => card.tier > best.tier ? card : best, openedCards[0])
    : null;
  const canOpenSinglePack = user?.username === 'Will!' || user?.username === 'TestUser';

  // Pack label text
  const getPackLabel = () => {
    if (!packInfo) return '';
    if (packInfo.packsRemaining === 0) return 'Buy Packs';
    if (packInfo.packsRemaining === 1) return '1 Pack';
    return `${packInfo.packsRemaining} Packs`;
  };

  return (
    <>
      <FoilPackOpening
        isOpen={showPackAnimation}
        onComplete={handleAnimationComplete}
        packType={currentPackType}
        cards={openedCards}
      />
      
      {/* Main field view - pack on left, best card on right */}
      {!showResults && (
        <div className="flex items-start justify-center gap-6 px-4">
          {/* Pack section */}
          <div className="flex flex-col items-center" style={{ marginTop: '220px' }}>
            <button
              onClick={packInfo?.packsRemaining > 0 ? handleOpenPack : () => router.push('/shop')}
              disabled={opening}
              className="relative transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
              style={{ width: '120px', height: '160px' }}
            >
              <img 
                src="/f10-pack.png" 
                alt="Card Pack" 
                className="w-full h-full object-contain"
                style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.5))' }}
              />
              {opening && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <div className="text-white text-sm f10-title">Opening...</div>
                </div>
              )}
            </button>
            <div 
              className="mt-2 text-white text-base tracking-wide"
              style={{ fontFamily: 'var(--f10-display-font)', fontWeight: 700 }}
            >
              {getPackLabel()}
            </div>
          </div>

          {/* Best card section */}
          <div className="flex flex-col items-center" style={{ marginTop: '200px' }}>
            {bestCard ? (
              <button
                onClick={goToCollection}
                className="transition-transform hover:scale-105 active:scale-95 overflow-hidden rounded-lg"
                style={{ width: '120px', height: '160px' }}
              >
                <div style={{ transform: 'scale(0.625)', transformOrigin: 'top left', width: '192px', height: '256px' }}>
                  <Card card={bestCard} small={false} />
                </div>
              </button>
            ) : (
              <div 
                onClick={goToCollection}
                className="rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-white/40 transition-colors"
                style={{ width: '120px', height: '160px' }}
              >
                <span className="text-white/40 text-sm text-center px-2" style={{ fontFamily: 'var(--f10-display-font)' }}>
                  No cards yet
                </span>
              </div>
            )}
            <div 
              className="mt-2 text-white text-base tracking-wide"
              style={{ fontFamily: 'var(--f10-display-font)', fontWeight: 700 }}
            >
              My Collection
            </div>
          </div>
        </div>
      )}

      {/* Results view after opening packs */}
      {showResults && openedCards.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-6">
            <h2 
              className="text-2xl text-white mb-2"
              style={{ fontFamily: 'var(--f10-display-font)', fontWeight: 700 }}
            >
              {openedCards.length <= 5 ? 'Pack Opened!' : `${Math.ceil(openedCards.length / 5)} Packs Opened!`}
            </h2>
            {openedBestCard && openedBestCard.tier >= 7 && (
              <p className="text-lg" style={{ color: `var(--tier-${openedBestCard.tier})`, fontFamily: 'var(--f10-display-font)' }}>
                You got a {TIER_NAMES[openedBestCard.tier]}!
              </p>
            )}
            <p className="text-sm text-gray-400 mt-2" style={{ fontFamily: 'var(--f10-display-font)' }}>
              Tap any card to view details
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {openedCards.map((card, index) => (
              <div
                key={card.id}
                className={`transition-all duration-500 cursor-pointer ${
                  index <= revealIndex ? 'opacity-100 transform scale-100' : 'opacity-0 transform scale-75'
                }`}
                onClick={() => index <= revealIndex && setSelectedCard(card)}
              >
                <Card card={card} small={openedCards.length > 10} />
              </div>
            ))}
          </div>
          <div className="text-center mt-6 space-x-4">
            <button
              onClick={goToCollection}
              className="px-6 py-2 text-white rounded-lg transition-colors"
              style={{ background: 'rgba(0,229,255,0.16)', border: '1px solid rgba(0,229,255,0.22)', fontFamily: 'var(--f10-display-font)' }}
            >
              View Collection
            </button>
            <button
              onClick={() => {
                setShowResults(false);
                setOpenedCards([]);
                loadBestCard(); // Refresh best card after opening
              }}
              className="px-6 py-2 text-white rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', fontFamily: 'var(--f10-display-font)' }}
            >
              {packInfo?.packsRemaining > 0 ? 'Open Another' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {selectedCard && (
        <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}

      {showAiPopup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="f10-panel p-6 max-w-md w-full text-center shadow-2xl" style={{ borderColor: 'rgba(0,229,255,0.22)' }}>
            <div className="text-5xl mb-4 animate-pulse">🎨</div>
            <h2 className="text-2xl text-white mb-3" style={{ fontFamily: 'var(--f10-display-font)', fontWeight: 700 }}>
              AI is generating unique card artwork!
            </h2>
            <p className="text-gray-300 mb-2">Your cards appear below with placeholder images.</p>
            <p className="text-gray-400 text-sm mb-6">
              The AI will generate unique artwork for each card. Check Collection in a few minutes to see the finished artwork.
            </p>
            <button
              onClick={() => setShowAiPopup(false)}
              className="px-8 py-3 text-white font-semibold rounded-xl transition-colors text-lg"
              style={{ background: 'rgba(0,229,255,0.16)', border: '1px solid rgba(0,229,255,0.22)', fontFamily: 'var(--f10-display-font)' }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}
