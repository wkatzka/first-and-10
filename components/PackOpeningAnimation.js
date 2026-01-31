import { useState, useRef, useEffect } from 'react';

export default function PackOpeningAnimation({ 
  isOpen, 
  onComplete, 
  packType = 'starter',
  children 
}) {
  const [phase, setPhase] = useState('idle'); // idle, showing, wiping, revealing, complete
  const [wipeProgress, setWipeProgress] = useState(0);
  const [cardsRevealed, setCardsRevealed] = useState(false);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const isDragging = useRef(false);
  
  useEffect(() => {
    if (isOpen && phase === 'idle') {
      setPhase('showing');
      setWipeProgress(0);
      setCardsRevealed(false);
    }
  }, [isOpen, phase]);
  
  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setWipeProgress(0);
      setCardsRevealed(false);
    }
  }, [isOpen]);
  
  const handleStart = (clientY) => {
    if (phase !== 'showing') return;
    startY.current = clientY;
    isDragging.current = true;
    setPhase('wiping');
  };
  
  const handleMove = (clientY) => {
    if (!isDragging.current || phase !== 'wiping') return;
    
    const delta = clientY - startY.current;
    const progress = Math.min(Math.max(delta / 200, 0), 1);
    setWipeProgress(progress);
    
    if (progress >= 1) {
      completeWipe();
    }
  };
  
  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    if (wipeProgress >= 0.5) {
      completeWipe();
    } else if (phase === 'wiping') {
      // Snap back
      setWipeProgress(0);
      setPhase('showing');
    }
  };
  
  const completeWipe = () => {
    isDragging.current = false;
    setWipeProgress(1);
    setPhase('revealing');
    setCardsRevealed(true);
    
    // After cards reveal animation, complete
    setTimeout(() => {
      setPhase('complete');
      if (onComplete) onComplete();
    }, 800);
  };
  
  // Skip animation with tap
  const handleTap = () => {
    if (phase === 'showing') {
      completeWipe();
    }
  };
  
  if (!isOpen || phase === 'complete') {
    return children;
  }
  
  const packGradient = packType === 'starter' 
    ? 'from-green-400 via-emerald-500 to-green-600'
    : 'from-purple-400 via-violet-500 to-purple-600';
  
  const foilGradient = packType === 'starter'
    ? 'from-green-300 via-white to-green-300'
    : 'from-purple-300 via-white to-purple-300';
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Pack Container */}
      <div
        ref={containerRef}
        className="relative w-72 h-96 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={(e) => handleStart(e.clientY)}
        onMouseMove={(e) => handleMove(e.clientY)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => handleStart(e.touches[0].clientY)}
        onTouchMove={(e) => handleMove(e.touches[0].clientY)}
        onTouchEnd={handleEnd}
        onClick={handleTap}
      >
        {/* Pack Base */}
        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${packGradient} shadow-2xl overflow-hidden`}>
          {/* Holographic Pattern */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(255,255,255,0.1) 10px,
                rgba(255,255,255,0.1) 20px
              )`,
            }}
          />
          
          {/* Pack Design */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="text-6xl mb-4">🏈</div>
            <div className="text-white font-bold text-2xl text-center drop-shadow-lg">
              First & 10
            </div>
            <div className="text-white/80 text-sm mt-2">
              {packType === 'starter' ? 'STARTER PACK' : 'BONUS PACK'}
            </div>
            <div className="text-white/60 text-xs mt-4">
              5 CARDS
            </div>
          </div>
          
          {/* Card Stack Peek (visible as foil is wiped) */}
          <div 
            className="absolute inset-4 rounded-xl bg-gray-800 overflow-hidden transition-opacity duration-300"
            style={{ opacity: wipeProgress }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Stacked cards effect */}
                {[4, 3, 2, 1, 0].map((i) => (
                  <div
                    key={i}
                    className="absolute w-32 h-44 rounded-lg bg-gradient-to-br from-gray-600 to-gray-700 border border-gray-500"
                    style={{
                      transform: `translateY(${i * -4}px) rotate(${(i - 2) * 3}deg)`,
                      zIndex: 5 - i,
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-50">
                      🃏
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Foil Overlay (wipes away) */}
        <div 
          className={`absolute inset-0 rounded-2xl overflow-hidden transition-transform duration-100 ease-out`}
          style={{
            transform: `translateY(${wipeProgress * 100}%)`,
            opacity: 1 - wipeProgress * 0.3,
          }}
        >
          {/* Foil Gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${foilGradient}`} />
          
          {/* Shimmer Effect */}
          <div 
            className="absolute inset-0"
            style={{
              background: `linear-gradient(
                105deg,
                transparent 40%,
                rgba(255,255,255,0.8) 45%,
                rgba(255,255,255,0.8) 50%,
                transparent 55%
              )`,
              backgroundSize: '200% 200%',
              animation: 'shimmer 2s infinite',
            }}
          />
          
          {/* Sealed Text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-800/40 font-bold text-lg tracking-widest">
                SEALED
              </div>
            </div>
          </div>
        </div>
        
        {/* Swipe Instruction */}
        {phase === 'showing' && (
          <div className="absolute -bottom-16 left-0 right-0 text-center animate-bounce">
            <div className="text-white/70 text-sm">
              👆 Swipe down to open
            </div>
            <div className="text-white/40 text-xs mt-1">
              or tap to skip
            </div>
          </div>
        )}
        
        {/* Wiping Indicator */}
        {phase === 'wiping' && wipeProgress > 0 && wipeProgress < 1 && (
          <div className="absolute -bottom-12 left-0 right-0">
            <div className="mx-auto w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-75"
                style={{ width: `${wipeProgress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Cards Flying Out Animation */}
      {cardsRevealed && (
        <div className="fixed inset-0 pointer-events-none">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 w-20 h-28 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg"
              style={{
                animation: `cardFlyOut 0.8s ease-out ${i * 0.1}s forwards`,
                transform: 'translate(-50%, -50%)',
                opacity: 0,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center text-2xl">
                🃏
              </div>
            </div>
          ))}
        </div>
      )}
      
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        @keyframes cardFlyOut {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.5) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: translate(
              calc(-50% + ${Math.random() * 100 - 50}px),
              calc(-50% - 100px)
            ) scale(1.2) rotate(${Math.random() * 30 - 15}deg);
          }
          100% {
            opacity: 0;
            transform: translate(
              calc(-50% + ${Math.random() * 200 - 100}px),
              calc(-50% + 300px)
            ) scale(0.8) rotate(${Math.random() * 60 - 30}deg);
          }
        }
      `}</style>
    </div>
  );
}
