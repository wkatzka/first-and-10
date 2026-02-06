import { useState } from 'react';
import { TIER_NAMES, TIER_COLORS, POSITION_COLORS, isHOFTier } from '../lib/api';

export default function Card({ card, onClick, selected, small, showImage = true }) {
  const [imageError, setImageError] = useState(false);
  const tierColor = TIER_COLORS[card.tier] || TIER_COLORS[1];
  const posColor = POSITION_COLORS[card.position] || '#6B7280';
  const isLegendary = card.tier >= 9;
  const isHOF = isHOFTier(card.tier);
  
  // HOF rainbow gradient style
  const hofGradient = 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3, #ff0000)';
  const hofBorderStyle = isHOF ? {
    background: hofGradient,
    backgroundSize: '200% 100%',
    animation: 'rainbowShift 3s linear infinite',
  } : {};
  
  // Check if image should be shown (has valid URL and hasn't errored)
  const hasValidImage = showImage && card.image_url && !small && !imageError && !card.image_url.includes('placeholder');
  
  // If card has an image_url and we want to show images, display the image card
  if (hasValidImage) {
    return (
      <div
        onClick={onClick}
        className={`
          relative rounded-lg overflow-hidden cursor-pointer
          transition-all duration-200 active:scale-95
          ${selected ? 'ring-4 ring-green-400' : ''}
          ${isHOF ? 'hof-rainbow-border' : ''}
          w-48
        `}
        style={{
          border: isHOF ? 'none' : `3px solid ${tierColor}`,
          boxShadow: isHOF 
            ? '0 0 25px rgba(255,255,255,0.5), 0 0 50px rgba(138,43,226,0.3)' 
            : isLegendary ? `0 0 20px ${tierColor}` : 'none',
          padding: isHOF ? '3px' : 0,
          background: isHOF ? hofGradient : 'transparent',
          backgroundSize: isHOF ? '200% 100%' : 'auto',
        }}
      >
        {isHOF && (
          <style jsx>{`
            @keyframes rainbowShift {
              0% { background-position: 0% 50%; }
              100% { background-position: 200% 50%; }
            }
          `}</style>
        )}
        <img 
          src={card.image_url} 
          alt={`${card.player_name || card.player} ${card.season}`}
          className="w-full h-auto rounded-md"
          style={{ aspectRatio: '512 / 720' }}
          onError={() => setImageError(true)}
        />
        
        {/* HOF Shimmer Animation */}
        {isHOF && (
          <div 
            className="absolute inset-0 pointer-events-none animate-pulse"
            style={{ 
              boxShadow: 'inset 0 0 40px rgba(255,255,255,0.4)',
              opacity: 0.5,
            }}
          />
        )}
        
        {/* Legendary Glow Animation */}
        {card.tier === 10 && (
          <div 
            className="absolute inset-0 pointer-events-none animate-pulse"
            style={{ 
              boxShadow: `inset 0 0 30px ${tierColor}`,
              opacity: 0.3,
            }}
          />
        )}
      </div>
    );
  }
  
  // Fallback to simple card layout (for small cards or if no image)
  if (small) {
    // Compact uniform card for grids
    return (
      <div
        onClick={onClick}
        className={`
          relative rounded-lg overflow-hidden cursor-pointer
          transition-all duration-200 active:scale-95
          ${selected ? 'ring-4 ring-green-400' : ''}
          w-full aspect-[3/4]
        `}
        style={{
          border: isHOF ? 'none' : `2px solid ${tierColor}`,
          boxShadow: isHOF 
            ? '0 0 15px rgba(255,255,255,0.4)' 
            : isLegendary ? `0 0 15px ${tierColor}` : 'none',
          padding: isHOF ? '2px' : 0,
          background: isHOF ? hofGradient : 'transparent',
          backgroundSize: isHOF ? '200% 100%' : 'auto',
        }}
      >
        {/* Card Background */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{ backgroundColor: tierColor }}
        />
        
        {/* Card Content - Fixed layout */}
        <div className="relative h-full p-2 flex flex-col">
          {/* Top row: Position + Tier */}
          <div className="flex justify-between items-start">
            <div 
              className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
              style={{ backgroundColor: posColor }}
            >
              {card.position}
            </div>
            <div 
              className="px-1.5 py-0.5 rounded text-[10px] font-bold"
              style={{ backgroundColor: tierColor, color: card.tier >= 9 ? '#000' : '#fff' }}
            >
              T{card.tier}
            </div>
          </div>
          
          {/* Player Name - truncated */}
          <div className="flex-1 flex items-center justify-center py-1">
            <h3 className="text-xs font-bold text-white text-center leading-tight line-clamp-2">
              {card.player_name || card.player}
            </h3>
          </div>
          
          {/* Bottom: Season & Team */}
          <div className="text-[10px] text-gray-400 text-center truncate">
            {card.season} · {card.team || ''}
          </div>
        </div>
        
        {/* HOF/Legendary Glow */}
        {(isHOF || card.tier === 10) && (
          <div 
            className="absolute inset-0 pointer-events-none animate-pulse"
            style={{ 
              boxShadow: isHOF 
                ? 'inset 0 0 15px rgba(255,255,255,0.5)' 
                : `inset 0 0 20px ${tierColor}`, 
              opacity: 0.3 
            }}
          />
        )}
      </div>
    );
  }
  
  // Full size card
  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-lg overflow-hidden cursor-pointer
        transition-all duration-200 active:scale-95
        ${selected ? 'ring-4 ring-green-400' : ''}
        w-48
      `}
      style={{
        border: isHOF ? 'none' : `${card.tier >= 9 ? 3 : 2}px solid ${tierColor}`,
        boxShadow: isHOF 
          ? '0 0 25px rgba(255,255,255,0.5), 0 0 50px rgba(138,43,226,0.3)' 
          : isLegendary ? `0 0 20px ${tierColor}` : 'none',
        padding: isHOF ? '3px' : 0,
        background: isHOF ? hofGradient : 'transparent',
        backgroundSize: isHOF ? '200% 100%' : 'auto',
      }}
    >
      {/* Card Background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{ backgroundColor: tierColor }}
      />
      
      {/* Card Content */}
      <div className="relative p-3">
        {/* Tier Badge */}
        <div 
          className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-bold"
          style={{ backgroundColor: tierColor, color: card.tier >= 9 ? '#000' : '#fff' }}
        >
          T{card.tier}
        </div>
        
        {/* Position Badge */}
        <div 
          className="inline-block px-2 py-0.5 rounded text-white font-bold text-sm"
          style={{ backgroundColor: posColor }}
        >
          {card.position}
        </div>
        
        {/* Player Name */}
        <h3 className="font-bold mt-2 text-lg text-white leading-tight">
          {card.player_name || card.player}
        </h3>
        
        {/* Season & Team */}
        <p className="text-gray-400 text-sm">
          {card.season} {card.team && `• ${card.team}`}
        </p>
        
        {/* Score */}
        {card.composite_score && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">OVR</span>
            <span 
              className="text-lg font-bold"
              style={{ color: tierColor }}
            >
              {Math.round(card.composite_score)}
            </span>
          </div>
        )}
        
        {/* Tier Name */}
        <div 
          className="mt-2 text-center text-xs font-semibold uppercase tracking-wider"
          style={{ color: tierColor }}
        >
          {TIER_NAMES[card.tier]}
        </div>
      </div>
      
      {/* HOF/Legendary Glow Animation */}
      {(isHOF || card.tier === 10) && (
        <div 
          className="absolute inset-0 pointer-events-none animate-pulse"
          style={{ 
            boxShadow: isHOF 
              ? 'inset 0 0 30px rgba(255,255,255,0.5)' 
              : `inset 0 0 30px ${tierColor}`,
            opacity: 0.3,
          }}
        />
      )}
    </div>
  );
}

// Mini card for roster slots; fieldSize = smaller for play diagram (5 in a row)
export function MiniCard({ card, position, onClick, empty, fieldSize }) {
  const [imageError, setImageError] = useState(false);
  const sizeClass = fieldSize ? 'w-14 h-[4.2rem]' : 'w-20 h-24';
  const textSize = fieldSize ? 'text-[8px]' : 'text-[10px]';

  if (empty || !card) {
    return (
      <button
        onClick={onClick}
        className={`${sizeClass} rounded-lg border-2 border-dashed border-gray-500 flex flex-col items-center justify-center bg-gray-700/30 active:bg-gray-600 active:border-blue-500 active:scale-95 transition-all`}
      >
        <span className={fieldSize ? 'text-lg mb-1' : 'text-2xl mb-1'}>+</span>
        <span className="text-gray-400 text-xs font-medium">{position}</span>
      </button>
    );
  }

  const tierColor = TIER_COLORS[card.tier] || TIER_COLORS[1];
  const hasImage = card.image_url && !imageError && !card.image_url.includes('placeholder');

  // Card with image - shows art with tier/position badges on top, name below
  return (
    <div className="flex flex-col items-center pointer-events-none">
      <button
        onClick={onClick}
        className={`${sizeClass} rounded-lg overflow-hidden active:scale-95 active:opacity-80 transition-all relative`}
        style={{ border: `2px solid ${tierColor}` }}
        tabIndex={-1}
      >
        {/* Card art or fallback */}
        {hasImage ? (
          <img 
            src={card.image_url} 
            alt={card.player_name || card.player}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="h-full w-full bg-gray-800" />
        )}
        
        {/* Tier and Position badges overlay */}
        <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-0.5">
          <span
            className={`${textSize} px-0.5 rounded font-bold`}
            style={{ backgroundColor: POSITION_COLORS[card.position], color: '#fff' }}
          >
            {card.position}
          </span>
          <span
            className={`${textSize} px-0.5 rounded font-bold`}
            style={{ backgroundColor: tierColor, color: card.tier >= 9 ? '#000' : '#fff' }}
          >
            {card.tier}
          </span>
        </div>
      </button>
      
      {/* Player name below card */}
      <span 
        className="text-white text-center leading-tight truncate w-full mt-0.5"
        style={{ 
          fontSize: fieldSize ? '9px' : '11px',
          fontFamily: 'var(--f10-display-font)',
          fontWeight: 700,
          textShadow: '0 1px 3px rgba(0,0,0,0.8)'
        }}
      >
        {(card.player_name || card.player || '').split(' ').slice(-1)[0]}
      </span>
    </div>
  );
}
