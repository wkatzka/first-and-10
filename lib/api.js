/**
 * API Client
 * ===========
 * Helper functions for API calls
 */

const API_BASE = '/api';

// Get auth token from localStorage
function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

// Set auth token
export function setToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

// API request helper
async function request(endpoint, options = {}) {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  
  return data;
}

// =============================================================================
// AUTH
// =============================================================================

// Check if username is pre-registered or exists
export async function checkUsername(username) {
  const response = await fetch(`/api/auth/check/${encodeURIComponent(username)}`);
  return response.json();
}

export async function register(username, password, teamName = null) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, teamName }),
  });
  setToken(data.token);
  return data;
}

export async function login(username, password, teamName = null) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, teamName }),
  });
  setToken(data.token);
  return data;
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch (e) {
    // Ignore errors
  }
  setToken(null);
}

export async function getMe() {
  return request('/auth/me');
}

export async function updateTeamName(teamName) {
  return request('/auth/team-name', {
    method: 'PUT',
    body: JSON.stringify({ teamName }),
  });
}

// =============================================================================
// PACKS
// =============================================================================

export async function getPackInfo() {
  return request('/packs/info');
}

export async function openPack() {
  return request('/packs/open', { method: 'POST' });
}

export async function openSinglePack() {
  return request('/packs/open-single', { method: 'POST' });
}

export async function openAllPacks() {
  return request('/packs/open-all', { method: 'POST' });
}

// =============================================================================
// CARDS
// =============================================================================

export async function getCards() {
  return request('/cards');
}

export async function getCardsByPosition(position) {
  return request(`/cards/position/${position}`);
}

export async function getCard(id) {
  return request(`/cards/${id}`);
}

// =============================================================================
// ROSTER
// =============================================================================

export async function getRoster() {
  return request('/roster');
}

export async function updateRoster(slots) {
  return request('/roster', {
    method: 'PUT',
    body: JSON.stringify({ slots }),
  });
}

export async function autoFillRoster() {
  return request('/roster/auto-fill', { method: 'POST' });
}

// =============================================================================
// GAMES
// =============================================================================

export async function getOpponents() {
  return request('/opponents');
}

export async function challengeOpponent(opponentId) {
  return request('/game/challenge', {
    method: 'POST',
    body: JSON.stringify({ opponentId }),
  });
}

export async function quickMatch() {
  return request('/game/quick-match', { method: 'POST' });
}

export async function getGame(id) {
  return request(`/game/${id}`);
}

export async function getGameHistory(limit = 20) {
  return request(`/games?limit=${limit}`);
}

// =============================================================================
// LEADERBOARD
// =============================================================================

export async function getLeaderboard(limit = 20) {
  return request(`/leaderboard?limit=${limit}`);
}

// Practice simulation (doesn't affect standings)
export async function simulatePractice(opponentId) {
  return request('/games/practice', {
    method: 'POST',
    body: JSON.stringify({ opponent_id: opponentId }),
  });
}

// =============================================================================
// VIEW OTHER USERS
// =============================================================================

export async function getAllUsers() {
  return request('/users');
}

export async function getUserCards(userId) {
  return request(`/users/${userId}/cards`);
}

export async function getUserRoster(userId) {
  return request(`/users/${userId}/roster`);
}

// =============================================================================
// PRESS CONFERENCE (Post-Game Chat)
// =============================================================================

export async function getActiveConferences() {
  return request('/press-conference');
}

export async function getConferenceMessages(gameId, since = null) {
  const params = since ? `?since=${encodeURIComponent(since)}` : '';
  return request(`/press-conference/${gameId}${params}`);
}

export async function sendConferenceMessage(gameId, content) {
  return request(`/press-conference/${gameId}/message`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

// =============================================================================
// DIRECT MESSAGES
// =============================================================================

export async function getUnreadCount() {
  return request('/messages/unread-count');
}

export async function getInbox() {
  return request('/messages/inbox');
}

export async function getConversation(userId) {
  return request(`/messages/conversation/${userId}`);
}

export async function sendMessage(toUserId, content) {
  return request('/messages/send', {
    method: 'POST',
    body: JSON.stringify({ to_user_id: toUserId, content }),
  });
}

// =============================================================================
// HELPERS
// =============================================================================

export const TIER_NAMES = {
  1: 'Basic',
  2: 'Common',
  3: 'Common+',
  4: 'Uncommon',
  5: 'Uncommon+',
  6: 'Rare',
  7: 'Very Rare',
  8: 'Ultra Rare',
  9: 'Epic',
  10: 'Legendary',
  11: 'Hall of Fame',
};

export const TIER_COLORS = {
  1: '#6B7280',   // Gray
  2: '#6B7280',   // Gray
  3: '#6B7280',   // Gray
  4: '#6B7280',   // Gray
  5: '#6B7280',   // Gray
  6: '#10B981',   // Platinum green
  7: '#EC4899',   // Pink
  8: '#8B5CF6',   // Purple
  9: '#F97316',   // Orange
  10: '#EAB308',  // Gold
  11: '#FFFFFF',  // Hall of Fame - White (rainbow effect handled in CSS)
};

// Special flag for HOF rainbow effect
export const isHOFTier = (tier) => tier === 11;

export const POSITION_COLORS = {
  QB: '#DC2626',
  RB: '#16A34A',
  WR: '#2563EB',
  TE: '#9333EA',
  OL: '#CA8A04',
  DL: '#EA580C',
  LB: '#DB2777',
  DB: '#0891B2',
  K: '#4B5563',
  P: '#6B7280',
};

/**
 * Generate strategic advantage text for a card based on position and stats
 * @param {Object} card - Card data with position, tier, and stats
 * @returns {string} - Short strategic advantage description
 */
export function getStrategicAdvantage(card) {
  const pos = card.position;
  const tier = card.tier || 5;
  const stats = card.stats || {};
  
  // Tier quality descriptors
  const quality = tier >= 9 ? 'Elite' : tier >= 7 ? 'Strong' : tier >= 5 ? 'Solid' : 'Developing';
  
  switch (pos) {
    case 'QB': {
      // Check for dual-threat vs pass-heavy
      const rushYds = stats.rush_yds_pg || stats['Rush Yds/G'] || 0;
      const attPg = stats.att_pg || stats['Att/G'] || 0;
      
      if (rushYds >= 25) {
        return `Dual-threat QB who adds rushing upside. Boosts both pass and run game ratings.`;
      } else if (attPg >= 28) {
        return `Pass-heavy QB who maximizes WR value. Benefits greatly from elite receivers.`;
      } else {
        return `Balanced QB with consistent production. Pairs well with any offensive roster.`;
      }
    }
    
    case 'RB': {
      return `${quality} runner who boosts ground game. OL quality directly impacts effectiveness.`;
    }
    
    case 'WR': {
      if (tier >= 7) {
        return `High-tier WR that triggers pass synergy bonus. Elevates QB's effectiveness significantly.`;
      }
      return `Receiving threat that supports the passing attack. Better WRs boost QB rating.`;
    }
    
    case 'TE': {
      return `Versatile player adding to both pass and run game. Small boost to overall offense.`;
    }
    
    case 'OL': {
      return `Protection rating affects QB time in pocket. Also key for run blocking efficiency.`;
    }
    
    case 'DL': {
      return `Pass rush specialist (70% weight). Pressures QBs and disrupts run plays (40% weight).`;
    }
    
    case 'LB': {
      return `Balanced defender covering run (40%) and pass (20%). Also contributes to pass rush.`;
    }
    
    case 'DB': {
      return `Primary pass coverage (50% of pass D). ${tier >= 7 ? 'Elite DB shuts down receivers.' : 'Defends against the air attack.'}`;
    }
    
    case 'K': {
      return `Kicker rating determines FG accuracy. Higher tier = more clutch kicks converted.`;
    }
    
    case 'P': {
      return `Punter rating affects distance and hangtime. Helps with field position battles.`;
    }
    
    default:
      return `Contributes to overall team rating.`;
  }
}
