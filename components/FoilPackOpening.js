import { useState, useRef, useEffect, useCallback } from 'react';
import Card from './Card';

/**
 * FoilPackOpening - Premium pack opening animation
 * 
 * Phases:
 * 1. Pack appears with shimmer
 * 2. User swipes down to tear open
 * 3. Cards revealed one by one
 * 4. Swipe cards away to collection
 */
export default function FoilPackOpening({ 
  isOpen, 
  onComplete, 
  cards = [],
  packType = 'starter',
}) {
  const [phase, setPhase] = useState('idle');
  // Phases: idle -> packAppear -> readyToOpen -> tearing -> cardsRevealed -> browsing -> complete
  
  const [tearProgress, setTearProgress] = useState(0);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [swipedCards, setSwipedCards] = useState([]);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [cardSwipeX, setCardSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [shimmerPosition, setShimmerPosition] = useState({ x: 50, y: 50 });
  
  const containerRef = useRef(null);
  const packRef = useRef(null);
  
  // Foil pack image (provided by user)
  const foilPackImage = '/foil-pack.png';
  
  // Start animation when opened
  useEffect(() => {
    if (isOpen && phase === 'idle') {
      setPhase('packAppear');
      setTearProgress(0);
      setCurrentCardIndex(0);
      setSwipedCards([]);
      setCardSwipeX(0);
      
      // Pack entrance animation
      setTimeout(() => setPhase('readyToOpen'), 600);
    }
  }, [isOpen, phase]);
  
  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setTearProgress(0);
      setCurrentCardIndex(0);
      setSwipedCards([]);
    }
  }, [isOpen]);
  
  // Shimmer follows mouse/touch
  const handleShimmerMove = useCallback((clientX, clientY) => {
    if (!packRef.current) return;
    const rect = packRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setShimmerPosition({ x, y });
  }, []);
  
  // TEARING HANDLERS
  const handleTearStart = (clientY) => {
    if (phase !== 'readyToOpen') return;
    setTouchStart({ x: 0, y: clientY });
    setIsDragging(true);
    setPhase('tearing');
  };
  
  const handleTearMove = (clientY) => {
    if (phase !== 'tearing' || !isDragging) return;
    
    const delta = clientY - touchStart.y;
    const progress = Math.min(Math.max(delta / 250, 0), 1);
    setTearProgress(progress);
    
    if (progress >= 1) {
      completeTear();
    }
  };
  
  const handleTearEnd = () => {
    if (phase !== 'tearing') return;
    setIsDragging(false);
    
    if (tearProgress >= 0.6) {
      completeTear();
    } else {
      // Snap back
      setTearProgress(0);
      setPhase('readyToOpen');
    }
  };
  
  const completeTear = () => {
    setIsDragging(false);
    setTearProgress(1);
    setPhase('cardsRevealed');
    
    // Brief pause then allow browsing
    setTimeout(() => {
      setPhase('browsing');
    }, 500);
  };
  
  // CARD SWIPING HANDLERS
  const handleCardSwipeStart = (clientX) => {
    if (phase !== 'browsing') return;
    setTouchStart({ x: clientX, y: 0 });
    setIsDragging(true);
  };
  
  const handleCardSwipeMove = (clientX) => {
    if (phase !== 'browsing' || !isDragging) return;
    const delta = clientX - touchStart.x;
    setCardSwipeX(delta);
  };
  
  const handleCardSwipeEnd = () => {
    if (phase !== 'browsing') return;
    setIsDragging(false);
    
    const threshold = 100;
    
    if (Math.abs(cardSwipeX) > threshold) {
      // Swipe away
      const direction = cardSwipeX > 0 ? 'right' : 'left';
      swipeCardAway(direction);
    } else {
      // Snap back
      setCardSwipeX(0);
    }
  };
  
  const swipeCardAway = (direction) => {
    const exitX = direction === 'right' ? 500 : -500;
    setCardSwipeX(exitX);
    
    setTimeout(() => {
      setSwipedCards(prev => [...prev, currentCardIndex]);
      
      if (currentCardIndex < cards.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
        setCardSwipeX(0);
      } else {
        // All cards swiped
        setPhase('complete');
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 300);
      }
    }, 200);
  };
  
  // Skip to end
  const handleSkip = () => {
    setPhase('complete');
    if (onComplete) onComplete();
  };
  
  // Touch/Mouse event handlers
  const handlePointerDown = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    if (phase === 'readyToOpen' || phase === 'tearing') {
      handleTearStart(clientY);
    } else if (phase === 'browsing') {
      handleCardSwipeStart(clientX);
    }
  };
  
  const handlePointerMove = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Update shimmer
    handleShimmerMove(clientX, clientY);
    
    if (phase === 'tearing') {
      handleTearMove(clientY);
    } else if (phase === 'browsing') {
      handleCardSwipeMove(clientX);
    }
  };
  
  const handlePointerUp = () => {
    if (phase === 'tearing') {
      handleTearEnd();
    } else if (phase === 'browsing') {
      handleCardSwipeEnd();
    }
  };
  
  if (!isOpen || phase === 'idle') return null;
  
  const currentCard = cards[currentCardIndex];
  const remainingCards = cards.length - currentCardIndex;
  
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden"
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      {/* Ambient glow background */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at ${shimmerPosition.x}% ${shimmerPosition.y}%, 
            ${packType === 'starter' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(168, 85, 247, 0.4)'} 0%, 
            transparent 50%)`,
          transition: 'background 0.1s ease-out',
        }}
      />
      
      {/* PACK PHASE */}
      {(phase === 'packAppear' || phase === 'readyToOpen' || phase === 'tearing') && (
        <div 
          ref={packRef}
          className={`relative cursor-grab active:cursor-grabbing select-none transition-all duration-500 ${
            phase === 'packAppear' ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
          }`}
          style={{ 
            width: '280px', 
            height: '400px',
            transform: phase === 'packAppear' ? 'scale(0) rotate(-10deg)' : 'scale(1) rotate(0deg)',
          }}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
        >
          {/* Pack Back (revealed as foil tears) */}
          <div 
            className="absolute inset-0 rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
          >
            {/* Cards inside pack */}
            <div className="absolute inset-4 flex items-center justify-center">
              <div className="relative" style={{ transform: `translateY(${tearProgress * 20}px)` }}>
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-36 h-52 rounded-lg"
                    style={{
                      background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                      border: '1px solid #4b5563',
                      transform: `translateX(-50%) translateY(${i * -3}px) rotate(${(i - 2) * 2}deg)`,
                      left: '50%',
                      opacity: 0.3 + (tearProgress * 0.7),
                      transition: 'opacity 0.2s',
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-3xl text-gray-600">
                      🏈
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* "Your Cards" text */}
            <div 
              className="absolute bottom-6 left-0 right-0 text-center"
              style={{ opacity: tearProgress }}
            >
              <span className="text-gray-400 text-sm">Your cards are ready!</span>
            </div>
          </div>
          
          {/* Foil Front (tears away) */}
          <div 
            className="absolute inset-0 rounded-xl overflow-hidden"
            style={{
              transform: `translateY(${tearProgress * 120}%) scaleY(${1 - tearProgress * 0.3})`,
              opacity: 1 - tearProgress * 0.5,
              transformOrigin: 'top center',
              transition: isDragging ? 'none' : 'all 0.3s ease-out',
            }}
          >
            {/* Metallic foil base */}
            <div 
              className="absolute inset-0"
              style={{
                background: `linear-gradient(
                  ${135 + shimmerPosition.x * 0.5}deg,
                  #c0c0c0 0%,
                  #e8e8e8 20%,
                  #ffffff 35%,
                  #d4d4d4 50%,
                  #a8a8a8 65%,
                  #e0e0e0 80%,
                  #b8b8b8 100%
                )`,
              }}
            />
            
            {/* Holographic shimmer overlay */}
            <div 
              className="absolute inset-0 mix-blend-overlay"
              style={{
                background: `
                  linear-gradient(
                    ${shimmerPosition.x * 3.6}deg,
                    rgba(255, 0, 128, 0.2) 0%,
                    rgba(0, 255, 255, 0.2) 25%,
                    rgba(255, 255, 0, 0.2) 50%,
                    rgba(128, 0, 255, 0.2) 75%,
                    rgba(255, 0, 128, 0.2) 100%
                  )
                `,
                transition: 'background 0.1s ease-out',
              }}
            />
            
            {/* Moving light reflection */}
            <div 
              className="absolute inset-0"
              style={{
                background: `radial-gradient(
                  ellipse 100% 60% at ${shimmerPosition.x}% ${shimmerPosition.y}%,
                  rgba(255, 255, 255, 0.6) 0%,
                  transparent 50%
                )`,
                transition: 'background 0.05s ease-out',
              }}
            />
            
            {/* Foil texture lines */}
            <div 
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 2px,
                  rgba(0,0,0,0.1) 2px,
                  rgba(0,0,0,0.1) 4px
                )`,
              }}
            />
            
            {/* Pack branding */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div 
                className="text-5xl mb-3 drop-shadow-lg"
                style={{ 
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                  transform: `translateY(${-tearProgress * 30}px)`,
                }}
              >
                🏈
              </div>
              <div 
                className="font-bold text-xl tracking-wide"
                style={{ 
                  color: 'rgba(0,0,0,0.4)',
                  textShadow: '1px 1px 0 rgba(255,255,255,0.5)',
                  transform: `translateY(${-tearProgress * 20}px)`,
                }}
              >
                FIRST & 10
              </div>
              <div 
                className="text-xs mt-2 tracking-widest"
                style={{ 
                  color: 'rgba(0,0,0,0.3)',
                  transform: `translateY(${-tearProgress * 10}px)`,
                }}
              >
                {packType === 'starter' ? '★ STARTER PACK ★' : '★ BONUS PACK ★'}
              </div>
            </div>
            
            {/* Tear edge effect */}
            {tearProgress > 0 && (
              <div 
                className="absolute left-0 right-0 h-8"
                style={{
                  bottom: '-4px',
                  background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.2))',
                  borderBottom: '2px solid rgba(0,0,0,0.1)',
                  transform: `scaleY(${1 + tearProgress})`,
                }}
              />
            )}
          </div>
          
          {/* Instruction text */}
          {phase === 'readyToOpen' && (
            <div className="absolute -bottom-20 left-0 right-0 text-center animate-bounce">
              <div className="text-white/80 text-base font-medium">
                👆 Swipe down to open
              </div>
              <button 
                onClick={handleSkip}
                className="text-white/40 text-xs mt-2 hover:text-white/60 transition-colors"
              >
                or tap here to skip
              </button>
            </div>
          )}
          
          {/* Tear progress indicator */}
          {phase === 'tearing' && tearProgress > 0 && (
            <div className="absolute -bottom-16 left-0 right-0 px-8">
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${tearProgress * 100}%`,
                    background: packType === 'starter' 
                      ? 'linear-gradient(90deg, #22c55e, #4ade80)' 
                      : 'linear-gradient(90deg, #a855f7, #c084fc)',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* CARDS PHASE */}
      {(phase === 'cardsRevealed' || phase === 'browsing') && currentCard && (
        <div 
          className="relative"
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
        >
          {/* Card stack behind */}
          {remainingCards > 1 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[...Array(Math.min(remainingCards - 1, 3))].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-48 h-auto rounded-xl bg-gray-800 border border-gray-700"
                  style={{
                    transform: `translateY(${(i + 1) * 8}px) scale(${1 - (i + 1) * 0.03})`,
                    opacity: 0.6 - i * 0.15,
                    aspectRatio: '2.5 / 3.5',
                  }}
                />
              ))}
            </div>
          )}
          
          {/* Current card */}
          <div 
            className={`relative cursor-grab active:cursor-grabbing transition-all ${
              phase === 'cardsRevealed' ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
            }`}
            style={{
              transform: `translateX(${cardSwipeX}px) rotate(${cardSwipeX * 0.05}deg)`,
              transition: isDragging ? 'none' : 'transform 0.3s ease-out',
            }}
          >
            <Card card={currentCard} showImage={true} />
            
            {/* Swipe indicators */}
            {phase === 'browsing' && Math.abs(cardSwipeX) > 20 && (
              <div 
                className={`absolute top-4 ${cardSwipeX > 0 ? 'right-4' : 'left-4'} 
                  px-3 py-1 rounded-full text-sm font-bold
                  ${cardSwipeX > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
                style={{ opacity: Math.min(Math.abs(cardSwipeX) / 100, 1) }}
              >
                {cardSwipeX > 0 ? 'KEEP →' : '← KEEP'}
              </div>
            )}
          </div>
          
          {/* Card counter */}
          <div className="absolute -bottom-16 left-0 right-0 text-center">
            <div className="text-white/80 text-sm">
              Card {currentCardIndex + 1} of {cards.length}
            </div>
            <div className="text-white/40 text-xs mt-1">
              Swipe to continue
            </div>
          </div>
          
          {/* Skip button */}
          <button 
            onClick={handleSkip}
            className="absolute -bottom-28 left-1/2 -translate-x-1/2 text-white/40 text-xs hover:text-white/60 transition-colors"
          >
            Skip to collection →
          </button>
        </div>
      )}
      
      {/* Particle effects on tear */}
      {phase === 'tearing' && tearProgress > 0.3 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${40 + Math.random() * 20}%`,
                top: `${45 + tearProgress * 20}%`,
                background: `linear-gradient(135deg, 
                  ${['#c0c0c0', '#ffd700', '#ff69b4', '#00ffff'][i % 4]} 0%, 
                  white 100%)`,
                animation: `sparkle ${0.5 + Math.random() * 0.5}s ease-out forwards`,
                animationDelay: `${Math.random() * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}
      
      <style jsx>{`
        @keyframes sparkle {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 60 + 20}px) scale(0);
          }
        }
      `}</style>
    </div>
  );
}
