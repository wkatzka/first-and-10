import { useState } from 'react';
import { TIER_NAMES, TIER_COLORS, POSITION_COLORS, isHOFTier, getStrategicAdvantage } from '../lib/api';

/**
 * Full-screen card modal with flip animation
 * Front: Card image
 * Back: Player stats
 */
export default function CardModal({ card, onClose }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  if (!card) return null;
  
  // Check if we should show the image
  const hasValidImage = card.image_url && !imageError && !card.image_url.includes('placeholder');
  
  const tierColor = TIER_COLORS[card.tier] || TIER_COLORS[1];
  const posColor = POSITION_COLORS[card.position] || '#6B7280';
  const isLegendary = card.tier >= 9;
  
  const handleFlip = (e) => {
    e.stopPropagation();
    setIsFlipped(!isFlipped);
  };
  
  const handleClose = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Format stats for display
  const formatStats = () => {
    const statList = [];
    
    // Add overall rating first
    if (card.composite_score) {
      statList.push({ label: 'Overall Rating', value: Math.round(card.composite_score), highlight: true });
    }
    
    const stats = card.stats || {};
    
    // Check if stats is already an array (new format)
    if (Array.isArray(stats)) {
      return [...statList, ...stats];
    }
    
    // Convert object to array (old format)
    for (const [key, value] of Object.entries(stats)) {
      if (value != null && value !== '' && value !== 0) {
        const label = key
          .replace(/_/g, ' ')
          .replace(/pg$/i, '/G')
          .replace(/\b\w/g, c => c.toUpperCase());
        const displayValue = typeof value === 'number' 
          ? (Number.isInteger(value) ? value : value.toFixed(1))
          : value;
        statList.push({ label, value: displayValue });
      }
    }
    
    return statList;
  };

  const stats = formatStats();
  
  return (
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      {/* Close button - larger touch target for mobile */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/60 hover:text-white text-4xl z-50 w-12 h-12 flex items-center justify-center"
      >
        ×
      </button>
      
      {/* Flip instruction */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm safe-area-pt">
        Tap card to flip
      </div>
      
      {/* Card container with perspective */}
      <div 
        className="relative cursor-pointer max-w-[90vw]"
        style={{ perspective: '1000px' }}
        onClick={handleFlip}
      >
        {/* Card inner - this rotates */}
        <div 
          className="relative transition-transform duration-700 w-[280px] h-[400px] sm:w-[320px] sm:h-[450px]"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* FRONT - Card Image */}
          <div 
            className="absolute inset-0 rounded-2xl overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              boxShadow: isLegendary ? `0 0 40px ${tierColor}` : '0 10px 40px rgba(0,0,0,0.5)',
            }}
          >
            {hasValidImage ? (
              <img 
                src={card.image_url} 
                alt={`${card.player_name || card.player}`}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              /* Fallback front design */
              <div 
                className="w-full h-full flex flex-col p-6"
                style={{
                  background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)`,
                  border: `4px solid ${tierColor}`,
                }}
              >
                <div 
                  className="px-3 py-1 rounded self-start text-sm font-bold"
                  style={{ backgroundColor: tierColor, color: card.tier >= 9 ? '#000' : '#fff' }}
                >
                  {TIER_NAMES[card.tier]}
                </div>
                
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div 
                      className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-bold"
                      style={{ backgroundColor: posColor }}
                    >
                      {card.position}
                    </div>
                  </div>
                </div>
                
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {card.player_name || card.player}
                  </h2>
                  <p style={{ color: tierColor }} className="text-lg">
                    {card.season} · {card.team}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* BACK - Stats */}
          <div 
            className="absolute inset-0 rounded-2xl overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)`,
              border: `4px solid ${tierColor}`,
              boxShadow: isLegendary ? `0 0 40px ${tierColor}` : '0 10px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div className="h-full flex flex-col p-5">
              {/* Header */}
              <div className="text-center mb-4">
                <div 
                  className="inline-block px-3 py-1 rounded text-sm font-bold mb-2"
                  style={{ backgroundColor: tierColor, color: card.tier >= 9 ? '#000' : '#fff' }}
                >
                  {TIER_NAMES[card.tier]}
                </div>
                <h2 className="text-xl font-bold text-white">
                  {card.player_name || card.player}
                </h2>
                <p className="text-sm" style={{ color: tierColor }}>
                  {card.position} · {card.season} · {card.team}
                </p>
              </div>
              
              {/* Strategic Advantage */}
              <div className="mb-3 p-2 rounded-lg bg-white/5 border border-white/10">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Strategic Advantage
                </div>
                <p className="text-sm text-gray-300 leading-snug">
                  {getStrategicAdvantage(card)}
                </p>
              </div>
              
              {/* Stats */}
              <div className="flex-1 overflow-y-auto">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  Season Statistics
                </div>
                <div className="space-y-1.5">
                  {stats.length > 0 ? (
                    stats.slice(0, 10).map((stat, i) => (
                      <div 
                        key={i}
                        className={`flex justify-between items-center py-1 px-2 rounded ${
                          stat.highlight ? 'bg-white/10' : 'bg-white/5'
                        }`}
                      >
                        <span className="text-gray-400 text-xs">{stat.label}</span>
                        <span 
                          className={`font-bold ${stat.highlight ? 'text-base' : 'text-sm'}`}
                          style={{ color: stat.highlight ? tierColor : '#fff' }}
                        >
                          {stat.value}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-center py-4">
                      No detailed stats available
                    </div>
                  )}
                </div>
              </div>
              
              {/* Footer */}
              <div 
                className="mt-4 pt-3 border-t text-center"
                style={{ borderColor: `${tierColor}40` }}
              >
                <div className="text-xs text-gray-500">FIRST & 10 · NFT CARD</div>
                <div className="text-xs text-gray-600 mt-1">Card #{card.id}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Flip indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/40">
        <div className={`w-2 h-2 rounded-full ${!isFlipped ? 'bg-white' : 'bg-white/30'}`} />
        <div className={`w-2 h-2 rounded-full ${isFlipped ? 'bg-white' : 'bg-white/30'}`} />
      </div>
    </div>
  );
}
