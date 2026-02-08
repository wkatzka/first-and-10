/**
 * Database Operations (Postgres)
 * ===============================
 * Used when DATABASE_URL is set. All functions are async.
 */

const crypto = require('crypto');
const db = require('./db');
const { query, transaction } = db;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// For compatibility: getDb() returns a minimal object (some code checks raw.users)
async function getDb() {
  const r = await query('SELECT id, username, team_name, packs_opened, max_packs FROM users');
  return { users: r.rows };
}

// =============================================================================
// SESSIONS
// =============================================================================

async function createSession(userId, username, teamName, expiresAt) {
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  await query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expiresAt]
  );
  return token;
}

async function getSession(token) {
  const r = await query(
    'SELECT s.token, s.user_id, s.expires_at, u.username, u.team_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1 AND s.expires_at > NOW()',
    [token]
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return { token: row.token, user_id: row.user_id, username: row.username, team_name: row.team_name };
}

async function deleteSession(token) {
  await query('DELETE FROM sessions WHERE token = $1', [token]);
}

// =============================================================================
// USERS
// =============================================================================

async function preregisterUser(username, maxPacks = 8) {
  const existing = await query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [username]);
  if (existing.rows.length > 0) throw new Error('Username already exists');
  const pre = await query('SELECT 1 FROM preregistered_users WHERE LOWER(username) = LOWER($1)', [username]);
  if (pre.rows.length > 0) throw new Error('Username already pre-registered');
  await query('INSERT INTO preregistered_users (username, max_packs) VALUES ($1, $2)', [username, maxPacks]);
  return { username, max_packs: maxPacks };
}

async function getPreregisteredUser(username) {
  const r = await query('SELECT * FROM preregistered_users WHERE LOWER(username) = LOWER($1)', [username]);
  return r.rows[0] || null;
}

async function claimPreregisteredUser(username, password, teamName = null) {
  const pre = await query('SELECT * FROM preregistered_users WHERE LOWER(username) = LOWER($1)', [username]);
  if (pre.rows.length === 0) throw new Error('Username not found. Ask the admin to create your account.');
  const preUser = pre.rows[0];
  // Already claimed: user exists in users (e.g. seed re-run or stale preregistered row). Authenticate instead of inserting.
  const existing = await query('SELECT id, username, team_name FROM users WHERE LOWER(username) = LOWER($1)', [preUser.username]);
  if (existing.rows.length > 0) {
    const user = await authenticateUser(preUser.username, password);
    await query('DELETE FROM preregistered_users WHERE id = $1', [preUser.id]);
    const row = existing.rows[0];
    return { id: row.id, username: row.username, team_name: row.team_name };
  }
  const hash = hashPassword(password);
  const team = teamName || `${preUser.username}'s Team`;
  const maxPacks = preUser.max_packs != null ? Number(preUser.max_packs) : 13;
  const userRes = await query(
    `INSERT INTO users (username, password_hash, team_name, max_packs) VALUES ($1, $2, $3, $4) RETURNING id, username, team_name`,
    [preUser.username, hash, team, maxPacks]
  );
  const user = userRes.rows[0];
  await query('DELETE FROM preregistered_users WHERE id = $1', [preUser.id]);
  await query(
    `INSERT INTO rosters (user_id) VALUES ($1)`,
    [user.id]
  );
  return { id: user.id, username: user.username, team_name: user.team_name };
}

async function listPreregistered() {
  const r = await query('SELECT * FROM preregistered_users');
  return r.rows;
}

async function createUser(username, password, teamName = null) {
  const existing = await query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [username]);
  if (existing.rows.length > 0) throw new Error('Username already exists');
  const pre = await query('SELECT 1 FROM preregistered_users WHERE LOWER(username) = LOWER($1)', [username]);
  if (pre.rows.length > 0) throw new Error('This username is reserved. Please set your password to claim it.');
  const hash = hashPassword(password);
  const team = teamName || `${username}'s Team`;
  const r = await query(
    `INSERT INTO users (username, password_hash, team_name, max_packs) VALUES ($1, $2, $3, 13) RETURNING id, username`,
    [username, hash, team]
  );
  const user = r.rows[0];
  await query('INSERT INTO rosters (user_id) VALUES ($1)', [user.id]);
  return { id: user.id, username: user.username };
}

async function authenticateUser(username, password) {
  const hash = hashPassword(password);
  const r = await query(
    'SELECT id, username, packs_opened, max_packs FROM users WHERE LOWER(username) = LOWER($1) AND password_hash = $2',
    [username, hash]
  );
  if (r.rows.length === 0) throw new Error('Invalid username or password');
  return r.rows[0];
}

async function getUser(userId) {
  const r = await query('SELECT id, username, team_name, packs_opened, max_packs, created_at FROM users WHERE id = $1', [userId]);
  return r.rows[0] || null;
}

async function getUserByUsername(username) {
  const r = await query('SELECT id, username, team_name, packs_opened, max_packs, created_at FROM users WHERE username = $1', [username]);
  return r.rows[0] || null;
}

async function getUserByUsernameCaseInsensitive(username) {
  const r = await query('SELECT id, username, team_name, packs_opened, max_packs, created_at FROM users WHERE LOWER(username) = LOWER($1)', [username]);
  return r.rows[0] || null;
}

async function getAllUsers() {
  const r = await query('SELECT id, username, team_name, packs_opened, created_at FROM users');
  return r.rows;
}

async function incrementPacksOpened(userId) {
  await query('UPDATE users SET packs_opened = packs_opened + 1 WHERE id = $1', [userId]);
}

async function updateTeamName(userId, teamName) {
  if (!teamName || teamName.trim().length < 2) throw new Error('Team name must be at least 2 characters');
  if (teamName.trim().length > 30) throw new Error('Team name must be 30 characters or less');
  const r = await query('UPDATE users SET team_name = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [teamName.trim(), userId]);
  if (r.rows.length === 0) throw new Error('User not found');
  return r.rows[0];
}

async function updateUserMaxPacks(userId, maxPacks) {
  const r = await query('UPDATE users SET max_packs = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [maxPacks, userId]);
  if (r.rows.length === 0) throw new Error('User not found');
  return r.rows[0];
}

async function setPasswordByUsername(username, newPassword) {
  if (!username || !newPassword) throw new Error('Username and password required');
  if (newPassword.length < 4) throw new Error('Password must be at least 4 characters');
  const hash = hashPassword(newPassword);
  const r = await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE LOWER(username) = LOWER($2) RETURNING id, username',
    [hash, username]
  );
  if (r.rows.length === 0) throw new Error('User not found');
  return r.rows[0];
}

// =============================================================================
// CARDS
// =============================================================================

async function addCard(userId, playerData) {
  let engine = {};
  try {
    if (!playerData.engine_traits || !playerData.engine_percentiles || Number(playerData.engine_v || 0) < 1) {
      const { buildEngineForCard } = require('./game-engine/player-traits');
      const built = buildEngineForCard({
        player_name: playerData.player || playerData.player_name,
        season: playerData.season,
        position: playerData.position,
        tier: playerData.tier,
        composite_score: playerData.composite_score,
      });
      if (built) engine = built;
    }
  } catch (e) {}
  const playerKey = playerData.player_key || `${playerData.player}_${playerData.season}`;
  const playerName = playerData.player || playerData.player_name;
  const r = await query(
    `INSERT INTO cards (user_id, player_key, player_name, season, team, position, tier, composite_score, stats, image_url, engine_v, engine_era, engine_percentiles, engine_traits, engine_inferred)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
    [
      userId, playerKey, playerName, playerData.season, playerData.team || 'Unknown', playerData.position,
      playerData.tier, playerData.composite_score ?? null, JSON.stringify(playerData.stats || {}), playerData.image_url || null,
      engine.engine_v ?? null, engine.engine_era ?? null, engine.engine_percentiles ? JSON.stringify(engine.engine_percentiles) : null,
      engine.engine_traits ? JSON.stringify(engine.engine_traits) : null, engine.engine_inferred ? JSON.stringify(engine.engine_inferred) : null
    ]
  );
  return r.rows[0].id;
}

async function getUserCards(userId) {
  const r = await query(
    'SELECT * FROM cards WHERE user_id = $1 ORDER BY tier DESC NULLS LAST, composite_score DESC NULLS LAST',
    [userId]
  );
  return r.rows.map(row => ({ ...row, stats: row.stats || {} }));
}

async function getCard(cardId) {
  const r = await query('SELECT * FROM cards WHERE id = $1', [cardId]);
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return { ...row, stats: row.stats || {} };
}

async function getUserCardsByPosition(userId, position) {
  const r = await query(
    'SELECT * FROM cards WHERE user_id = $1 AND position = $2 ORDER BY tier DESC NULLS LAST, composite_score DESC NULLS LAST',
    [userId, position]
  );
  return r.rows.map(row => ({ ...row, stats: row.stats || {} }));
}

async function updateCardImage(cardId, imageUrl) {
  const r = await query('UPDATE cards SET image_url = $1 WHERE id = $2 RETURNING *', [imageUrl, cardId]);
  return r.rows[0] || null;
}

// =============================================================================
// ROSTERS
// =============================================================================

async function getRoster(userId) {
  const r = await query('SELECT * FROM rosters WHERE user_id = $1', [userId]);
  return r.rows[0] || null;
}

async function updateRoster(userId, slots) {
  const slotKeys = ['qb_card_id', 'rb_card_id', 'wr1_card_id', 'wr2_card_id', 'te_card_id', 'ol_card_id', 'dl_card_id', 'lb_card_id', 'db1_card_id', 'db2_card_id', 'k_card_id'];
  let r = await query('SELECT id FROM rosters WHERE user_id = $1', [userId]);
  if (r.rows.length === 0) {
    await query('INSERT INTO rosters (user_id) VALUES ($1)', [userId]);
    r = await query('SELECT id FROM rosters WHERE user_id = $1', [userId]);
  }
  const updates = [];
  const values = [];
  let i = 1;
  for (const key of slotKeys) {
    if (slots.hasOwnProperty(key)) {
      updates.push(`${key} = $${i++}`);
      values.push(slots[key]);
    }
  }
  if (updates.length > 0) {
    values.push(userId);
    await query(`UPDATE rosters SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = $${i}`, values);
  }
  return getRoster(userId);
}

async function getFullRoster(userId) {
  const roster = await getRoster(userId);
  if (!roster) return { roster: {}, cards: {} };
  const slotKeys = ['qb_card_id', 'rb_card_id', 'wr1_card_id', 'wr2_card_id', 'te_card_id', 'ol_card_id', 'dl_card_id', 'lb_card_id', 'db1_card_id', 'db2_card_id', 'k_card_id'];
  const cards = {};
  for (const key of slotKeys) {
    const cardId = roster[key];
    if (cardId) {
      const card = await getCard(cardId);
      if (card) cards[key] = card;
    }
  }
  return { roster, cards };
}

// =============================================================================
// GAMES
// =============================================================================

async function recordGame(homeUserId, awayUserId, homeScore, awayScore, winnerUserId, playByPlay) {
  const r = await query(
    'INSERT INTO games (home_user_id, away_user_id, home_score, away_score, winner_user_id, play_by_play) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [homeUserId, awayUserId, homeScore, awayScore, winnerUserId, playByPlay ? JSON.stringify(playByPlay) : null]
  );
  return r.rows[0].id;
}

async function getGame(gameId) {
  const r = await query('SELECT * FROM games WHERE id = $1', [gameId]);
  if (r.rows.length === 0) return null;
  const g = r.rows[0];
  const homeUser = await getUser(g.home_user_id);
  const awayUser = await getUser(g.away_user_id);
  const winnerUser = g.winner_user_id ? await getUser(g.winner_user_id) : null;
  return { ...g, play_by_play: g.play_by_play, home_username: homeUser?.username, away_username: awayUser?.username, winner_username: winnerUser?.username };
}

async function getUserGames(userId, limit = 20) {
  const r = await query(
    `SELECT g.* FROM games g WHERE g.home_user_id = $1 OR g.away_user_id = $1 ORDER BY g.played_at DESC LIMIT $2`,
    [userId, limit]
  );
  const out = [];
  for (const g of r.rows) {
    const homeUser = await getUser(g.home_user_id);
    const awayUser = await getUser(g.away_user_id);
    out.push({ ...g, home_username: homeUser?.username, away_username: awayUser?.username, play_by_play: undefined });
  }
  return out;
}

async function getUserStats(userId) {
  const r = await query('SELECT * FROM games WHERE home_user_id = $1 OR away_user_id = $1', [userId]);
  let wins = 0, losses = 0, ties = 0, pointsFor = 0, pointsAgainst = 0;
  for (const game of r.rows) {
    const isHome = game.home_user_id === userId;
    const myScore = isHome ? game.home_score : game.away_score;
    const theirScore = isHome ? game.away_score : game.home_score;
    pointsFor += myScore;
    pointsAgainst += theirScore;
    if (game.winner_user_id === userId) wins++;
    else if (game.winner_user_id === null) ties++;
    else losses++;
  }
  return { total_games: r.rows.length, wins, losses, ties, points_for: pointsFor, points_against: pointsAgainst };
}

async function getLeaderboard(limit = 20) {
  const users = await getAllUsers();
  const withStats = [];
  for (const u of users) {
    const stats = await getUserStats(u.id);
    withStats.push({ ...u, ...stats });
  }
  // Sort: users with games first (by wins, then win%), then 0-game users alphabetically
  return withStats
    .sort((a, b) => {
      if (a.total_games > 0 && b.total_games === 0) return -1;
      if (a.total_games === 0 && b.total_games > 0) return 1;
      if (a.total_games === 0 && b.total_games === 0) return (a.username || '').localeCompare(b.username || '');
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aPct = a.total_games > 0 ? a.wins / a.total_games : 0;
      const bPct = b.total_games > 0 ? b.wins / b.total_games : 0;
      return bPct - aPct;
    })
    .slice(0, limit);
}

async function getH2HRecords(userId) {
  const r = await query('SELECT * FROM games WHERE home_user_id = $1 OR away_user_id = $1', [userId]);
  const records = {};

  for (const game of r.rows) {
    const isHome = game.home_user_id === userId;
    const opponentId = isHome ? game.away_user_id : game.home_user_id;

    if (!records[opponentId]) records[opponentId] = { wins: 0, losses: 0, ties: 0 };

    if (game.winner_user_id === userId) {
      records[opponentId].wins++;
    } else if (game.winner_user_id === null) {
      records[opponentId].ties++;
    } else {
      records[opponentId].losses++;
    }
  }

  return records;
}

// =============================================================================
// WALLETS
// =============================================================================

async function getUserWallet(userId) {
  const r = await query('SELECT id, user_id, chain_id, address, wallet_type FROM wallets WHERE user_id = $1', [userId]);
  if (r.rows.length === 0) return null;
  const w = r.rows[0];
  return { id: w.id, user_id: w.user_id, chain_id: w.chain_id, address: w.address, wallet_type: w.wallet_type };
}

async function linkWallet(userId, address, walletType, chainId = 8453) {
  await query(
    'INSERT INTO wallets (user_id, address, wallet_type, chain_id) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET address = $2, wallet_type = $3, chain_id = $4, updated_at = NOW()',
    [userId, address, walletType, chainId]
  );
  return getUserWallet(userId);
}

async function getWalletByAddress(address) {
  const r = await query('SELECT * FROM wallets WHERE LOWER(address) = LOWER($1)', [address]);
  return r.rows[0] || null;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  getDb,
  createSession,
  getSession,
  deleteSession,
  createUser,
  authenticateUser,
  getUser,
  getUserByUsername,
  getUserByUsernameCaseInsensitive,
  getAllUsers,
  incrementPacksOpened,
  updateTeamName,
  updateUserMaxPacks,
  setPasswordByUsername,
  preregisterUser,
  getPreregisteredUser,
  claimPreregisteredUser,
  listPreregistered,
  addCard,
  getUserCards,
  getCard,
  getUserCardsByPosition,
  updateCardImage,
  getRoster,
  updateRoster,
  getFullRoster,
  recordGame,
  getGame,
  getUserGames,
  getUserStats,
  getLeaderboard,
  getH2HRecords,
  getUserWallet,
  linkWallet,
  getWalletByAddress,
};
