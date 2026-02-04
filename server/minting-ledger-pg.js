/**
 * Minting Ledger (Postgres)
 * =========================
 * Tracks which player/season cards have been minted. Async API.
 */

const db = require('./db');

function getCardKey(player) {
  const name = (player.player || '').toLowerCase().trim();
  const season = player.season || 0;
  return `${name}_${season}`;
}

async function isCardMinted(player) {
  const key = getCardKey(player);
  const result = await db.query('SELECT 1 FROM minted_cards WHERE player_key = $1', [key]);
  return result.rows.length > 0;
}

async function mintCard(player, userId) {
  const key = getCardKey(player);
  return db.transaction(async (client) => {
    const existing = await client.query('SELECT 1 FROM minted_cards WHERE player_key = $1 FOR UPDATE', [key]);
    if (existing.rows.length > 0) {
      throw new Error(`Card already minted: ${player.player} (${player.season})`);
    }
    await client.query(
      'INSERT INTO minted_cards (player_key, player_name, season, tier, user_id) VALUES ($1, $2, $3, $4, $5)',
      [key, player.player, player.season, player.tier, userId]
    );
    return true;
  });
}

async function getMintedCards() {
  const result = await db.query('SELECT * FROM minted_cards ORDER BY minted_at DESC');
  const ledger = {};
  for (const row of result.rows) {
    ledger[row.player_key] = { userId: row.user_id, mintedAt: row.minted_at, player: row.player_name, season: row.season, tier: row.tier };
  }
  return ledger;
}

async function getMintedCount() {
  const result = await db.query('SELECT COUNT(*) as count FROM minted_cards');
  return parseInt(result.rows[0].count);
}

async function getUserMintedCards(userId) {
  const result = await db.query(
    'SELECT player_key as key, player_name as player, season, tier, minted_at, user_id FROM minted_cards WHERE user_id = $1 ORDER BY minted_at DESC',
    [userId]
  );
  return result.rows;
}

async function getAvailabilityStats(totalPlayers = 122522) {
  const minted = await getMintedCount();
  return {
    totalCards: totalPlayers,
    mintedCards: minted,
    availableCards: totalPlayers - minted,
    percentMinted: ((minted / totalPlayers) * 100).toFixed(2) + '%',
  };
}

async function resetLedger() {
  await db.query('DELETE FROM minted_cards');
  console.log('Minting ledger has been reset');
}

function loadLedger() {
  return {};
}

module.exports = {
  loadLedger,
  getCardKey,
  isCardMinted,
  mintCard,
  getMintedCards,
  getMintedCount,
  getUserMintedCards,
  getAvailabilityStats,
  resetLedger,
};
