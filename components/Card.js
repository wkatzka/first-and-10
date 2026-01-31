import { useState } from 'react';
import { TIER_NAMES, TIER_COLORS, POSITION_COLORS } from '../lib/api';

export default function Card({ card, onClick, selected, small, showImage = true }) {
  const [imageError, setImageError] = useState(false);
  const tierColor = TIER_COLORS[card.tier] || TIER_COLORS[1];
  const posColor = POSITION_COLORS[card.position] || '#6B7280';
  const isLegendary = card.tier >= 9;
  
  // Check if image should be shown (has valid URL and hasn't errored)
  const hasValidImage = showImage && card.image_url && !small && !imageError && !card.image_url.includes('placeholder');
  
  // If card has an image_url and we want to show images, display the image card
  if (hasValidImage) {
    return (
      <div
        onClick={onClick}
        className={`
          relative rounded-lg overflow-hidden cursor-pointer
          transition-all duration-300 transform hover:scale-105
          ${selected ? 'ring-4 ring-green-400 scale-105' : ''}
          w-48
        `}
        style={{
          boxShadow: isLegendary ? `0 0 20px ${tierColor}` : 'none',
        }}
      >
        <img 
          src={card.image_url} 
          alt={`${card.player_name || card.player} ${card.season}`}
          className="w-full h-auto"
          style={{ aspectRatio: '512 / 720' }}
          onError={() => setImageError(true)}
        />
        
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
  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-lg overflow-hidden cursor-pointer
        transition-all duration-300 transform hover:scale-105
        ${selected ? 'ring-4 ring-green-400 scale-105' : ''}
        ${small ? 'w-32' : 'w-48'}
      `}
      style={{
        border: `${card.tier >= 9 ? 3 : 2}px solid ${tierColor}`,
        boxShadow: isLegendary ? `0 0 20px ${tierColor}` : 'none',
      }}
    >
      {/* Card Background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{ backgroundColor: tierColor }}
      />
      
      {/* Card Content */}
      <div className={`relative ${small ? 'p-2' : 'p-3'}`}>
        {/* Tier Badge */}
        <div 
          className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-xs font-bold ${small ? 'text-[10px]' : ''}`}
          style={{ backgroundColor: tierColor, color: card.tier >= 9 ? '#000' : '#fff' }}
        >
          T{card.tier}
        </div>
        
        {/* Position Badge */}
        <div 
          className={`inline-block px-2 py-0.5 rounded text-white font-bold ${small ? 'text-xs' : 'text-sm'}`}
          style={{ backgroundColor: posColor }}
        >
          {card.position}
        </div>
        
        {/* Player Name */}
        <h3 className={`font-bold mt-2 ${small ? 'text-sm' : 'text-lg'} text-white leading-tight`}>
          {card.player_name || card.player}
        </h3>
        
        {/* Season & Team */}
        <p className={`text-gray-400 ${small ? 'text-xs' : 'text-sm'}`}>
          {card.season} {card.team && `• ${card.team}`}
        </p>
        
        {/* Score */}
        {!small && card.composite_score && (
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
        {!small && (
          <div 
            className="mt-2 text-center text-xs font-semibold uppercase tracking-wider"
            style={{ color: tierColor }}
          >
            {TIER_NAMES[card.tier]}
          </div>
        )}
      </div>
      
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

// Mini card for roster slots
export function MiniCard({ card, position, onClick, empty }) {
  if (empty || !card) {
    return (
      <div
        onClick={onClick}
        className="w-20 h-24 rounded border-2 border-dashed border-gray-600 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
      >
        <span className="text-gray-500 text-xs">{position}</span>
      </div>
    );
  }
  
  const tierColor = TIER_COLORS[card.tier] || TIER_COLORS[1];
  
  return (
    <div
      onClick={onClick}
      className="w-20 h-24 rounded overflow-hidden cursor-pointer hover:scale-105 transition-transform"
      style={{ border: `2px solid ${tierColor}` }}
    >
      <div className="h-full flex flex-col p-1 bg-gray-800">
        <div className="flex justify-between items-start">
          <span 
            className="text-[10px] px-1 rounded font-bold"
            style={{ backgroundColor: POSITION_COLORS[card.position], color: '#fff' }}
          >
            {card.position}
          </span>
          <span 
            className="text-[10px] px-1 rounded font-bold"
            style={{ backgroundColor: tierColor, color: card.tier >= 9 ? '#000' : '#fff' }}
          >
            {card.tier}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-center text-white font-medium leading-tight">
            {(card.player_name || card.player || '').split(' ').slice(-1)[0]}
          </span>
        </div>
        <div className="text-[8px] text-gray-400 text-center">
          {card.season}
        </div>
      </div>
    </div>
  );
}
