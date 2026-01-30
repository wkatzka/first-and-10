/**
 * Database Operations (JSON File-based for MVP)
 * ==============================================
 * Simple JSON file database for First & 10 MVP
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data.json');

// Default database structure
const DEFAULT_DB = {
  users: [],
  cards: [],
  rosters: [],
  games: [],
  nextUserId: 1,
  nextCardId: 1,
  nextGameId: 1,
};

// Load database
function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load database:', err);
  }
  return { ...DEFAULT_DB };
}

// Save database
function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Get database instance
let dbCache = null;
function getDb() {
  if (!dbCache) {
    dbCache = loadDb();
  }
  return dbCache;
}

// Hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// =============================================================================
// USER OPERATIONS
// =============================================================================

function createUser(username, password) {
  const db = getDb();
  
  // Check if username exists
  if (db.users.find(u => u.username === username)) {
    throw new Error('Username already exists');
  }
  
  const user = {
    id: db.nextUserId++,
    username,
    password_hash: hashPassword(password),
    created_at: new Date().toISOString(),
    packs_opened: 0,
    max_packs: 8,
  };
  
  db.users.push(user);
  
  // Create empty roster
  db.rosters.push({
    id: user.id,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  });
  
  saveDb(db);
  
  return { id: user.id, username: user.username };
}

function authenticateUser(username, password) {
  const db = getDb();
  const hash = hashPassword(password);
  
  const user = db.users.find(u => u.username === username && u.password_hash === hash);
  
  if (!user) {
    throw new Error('Invalid username or password');
  }
  
  return {
    id: user.id,
    username: user.username,
    packs_opened: user.packs_opened,
    max_packs: user.max_packs,
  };
}

function getUser(userId) {
  const db = getDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;
  
  return {
    id: user.id,
    username: user.username,
    packs_opened: user.packs_opened,
    max_packs: user.max_packs,
    created_at: user.created_at,
  };
}

function getUserByUsername(username) {
  const db = getDb();
  const user = db.users.find(u => u.username === username);
  if (!user) return null;
  
  return {
    id: user.id,
    username: user.username,
    packs_opened: user.packs_opened,
    max_packs: user.max_packs,
    created_at: user.created_at,
  };
}

function getAllUsers() {
  const db = getDb();
  return db.users.map(u => ({
    id: u.id,
    username: u.username,
    packs_opened: u.packs_opened,
    created_at: u.created_at,
  }));
}

function incrementPacksOpened(userId) {
  const db = getDb();
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.packs_opened++;
    saveDb(db);
  }
}

// =============================================================================
// CARD OPERATIONS
// =============================================================================

function addCard(userId, playerData) {
  const db = getDb();
  
  const card = {
    id: db.nextCardId++,
    user_id: userId,
    player_key: playerData.player_key || `${playerData.player}_${playerData.season}`,
    player_name: playerData.player,
    season: playerData.season,
    team: playerData.team || 'Unknown',
    position: playerData.position,
    tier: playerData.tier,
    composite_score: playerData.composite_score,
    stats: playerData.stats || {},
    image_url: playerData.image_url || null,
    created_at: new Date().toISOString(),
  };
  
  db.cards.push(card);
  saveDb(db);
  
  return card.id;
}

function getUserCards(userId) {
  const db = getDb();
  return db.cards
    .filter(c => c.user_id === userId)
    .sort((a, b) => {
      if (b.tier !== a.tier) return b.tier - a.tier;
      return (b.composite_score || 0) - (a.composite_score || 0);
    });
}

function getCard(cardId) {
  const db = getDb();
  return db.cards.find(c => c.id === cardId) || null;
}

function getUserCardsByPosition(userId, position) {
  const db = getDb();
  return db.cards
    .filter(c => c.user_id === userId && c.position === position)
    .sort((a, b) => {
      if (b.tier !== a.tier) return b.tier - a.tier;
      return (b.composite_score || 0) - (a.composite_score || 0);
    });
}

// =============================================================================
// ROSTER OPERATIONS
// =============================================================================

function getRoster(userId) {
  const db = getDb();
  return db.rosters.find(r => r.user_id === userId) || null;
}

function updateRoster(userId, slots) {
  const db = getDb();
  let roster = db.rosters.find(r => r.user_id === userId);
  
  if (!roster) {
    roster = { id: userId, user_id: userId };
    db.rosters.push(roster);
  }
  
  // Update slots
  for (const [key, value] of Object.entries(slots)) {
    roster[key] = value;
  }
  
  roster.updated_at = new Date().toISOString();
  saveDb(db);
  
  return roster;
}

function getFullRoster(userId) {
  const db = getDb();
  const roster = getRoster(userId);
  if (!roster) return { roster: {}, cards: {} };
  
  const cards = {};
  // 11-player roster: QB, RB, WR×2, TE, OL, DL, LB, DB×2, K
  const slotKeys = [
    'qb_card_id', 'rb_card_id',
    'wr1_card_id', 'wr2_card_id', 'te_card_id',
    'ol_card_id', 'dl_card_id', 'lb_card_id',
    'db1_card_id', 'db2_card_id',
    'k_card_id'
  ];
  
  for (const key of slotKeys) {
    if (roster[key]) {
      const card = getCard(roster[key]);
      if (card) {
        cards[key] = card;
      }
    }
  }
  
  return { roster, cards };
}

// =============================================================================
// GAME OPERATIONS
// =============================================================================

function recordGame(homeUserId, awayUserId, homeScore, awayScore, winnerUserId, playByPlay) {
  const db = getDb();
  
  const game = {
    id: db.nextGameId++,
    home_user_id: homeUserId,
    away_user_id: awayUserId,
    home_score: homeScore,
    away_score: awayScore,
    winner_user_id: winnerUserId,
    play_by_play: playByPlay,
    played_at: new Date().toISOString(),
  };
  
  db.games.push(game);
  saveDb(db);
  
  return game.id;
}

function getGame(gameId) {
  const db = getDb();
  const game = db.games.find(g => g.id === gameId);
  if (!game) return null;
  
  const homeUser = getUser(game.home_user_id);
  const awayUser = getUser(game.away_user_id);
  const winnerUser = game.winner_user_id ? getUser(game.winner_user_id) : null;
  
  return {
    ...game,
    home_username: homeUser?.username,
    away_username: awayUser?.username,
    winner_username: winnerUser?.username,
  };
}

function getUserGames(userId, limit = 20) {
  const db = getDb();
  
  return db.games
    .filter(g => g.home_user_id === userId || g.away_user_id === userId)
    .sort((a, b) => new Date(b.played_at) - new Date(a.played_at))
    .slice(0, limit)
    .map(g => {
      const homeUser = getUser(g.home_user_id);
      const awayUser = getUser(g.away_user_id);
      return {
        ...g,
        home_username: homeUser?.username,
        away_username: awayUser?.username,
        play_by_play: undefined, // Don't include full play-by-play in list
      };
    });
}

function getUserStats(userId) {
  const db = getDb();
  const games = db.games.filter(g => g.home_user_id === userId || g.away_user_id === userId);
  
  let wins = 0, losses = 0, ties = 0, pointsFor = 0, pointsAgainst = 0;
  
  for (const game of games) {
    const isHome = game.home_user_id === userId;
    const myScore = isHome ? game.home_score : game.away_score;
    const theirScore = isHome ? game.away_score : game.home_score;
    
    pointsFor += myScore;
    pointsAgainst += theirScore;
    
    if (game.winner_user_id === userId) {
      wins++;
    } else if (game.winner_user_id === null) {
      ties++;
    } else {
      losses++;
    }
  }
  
  return {
    total_games: games.length,
    wins,
    losses,
    ties,
    points_for: pointsFor,
    points_against: pointsAgainst,
  };
}

function getLeaderboard(limit = 20) {
  const db = getDb();
  
  // Get stats for all users
  const userStats = db.users.map(user => {
    const stats = getUserStats(user.id);
    return {
      id: user.id,
      username: user.username,
      ...stats,
    };
  });
  
  // Filter to users with games and sort
  return userStats
    .filter(u => u.total_games > 0)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aWinPct = a.total_games > 0 ? a.wins / a.total_games : 0;
      const bWinPct = b.total_games > 0 ? b.wins / b.total_games : 0;
      return bWinPct - aWinPct;
    })
    .slice(0, limit);
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  getDb,
  
  // Users
  createUser,
  authenticateUser,
  getUser,
  getUserByUsername,
  getAllUsers,
  incrementPacksOpened,
  
  // Cards
  addCard,
  getUserCards,
  getCard,
  getUserCardsByPosition,
  
  // Rosters
  getRoster,
  updateRoster,
  getFullRoster,
  
  // Games
  recordGame,
  getGame,
  getUserGames,
  getUserStats,
  getLeaderboard,
};
