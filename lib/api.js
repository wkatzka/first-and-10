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
};

export const TIER_COLORS = {
  1: '#9CA3AF',
  2: '#6B7280',
  3: '#22C55E',
  4: '#3B82F6',
  5: '#6366F1',
  6: '#8B5CF6',
  7: '#A855F7',
  8: '#EC4899',
  9: '#F97316',
  10: '#EAB308',
};

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
