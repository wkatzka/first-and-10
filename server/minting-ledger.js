/**
 * Minting Ledger
 * ===============
 * Tracks which player/season cards have been minted.
 * Each card can only exist ONCE across all users.
 */

const fs = require('fs');
const path = require('path');

const LEDGER_PATH = path.join(__dirname, 'minting-ledger.json');

// Ledger structure: { "player_season": { userId, mintedAt } }
let ledger = null;

/**
 * Load the minting ledger
 */
function loadLedger() {
  if (ledger !== null) return ledger;
  
  try {
    if (fs.existsSync(LEDGER_PATH)) {
      const data = fs.readFileSync(LEDGER_PATH, 'utf-8');
      ledger = JSON.parse(data);
    } else {
      ledger = {};
    }
  } catch (err) {
    console.error('Failed to load minting ledger:', err);
    ledger = {};
  }
  
  return ledger;
}

/**
 * Save the minting ledger
 */
function saveLedger() {
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

/**
 * Generate a unique key for a player/season
 */
function getCardKey(player) {
  // Use player name + season as unique identifier
  const name = (player.player || '').toLowerCase().trim();
  const season = player.season || 0;
  return `${name}_${season}`;
}

/**
 * Check if a card has already been minted
 */
function isCardMinted(player) {
  loadLedger();
  const key = getCardKey(player);
  return key in ledger;
}

/**
 * Mark a card as minted
 */
function mintCard(player, userId) {
  loadLedger();
  const key = getCardKey(player);
  
  if (key in ledger) {
    throw new Error(`Card already minted: ${player.player} (${player.season})`);
  }
  
  ledger[key] = {
    userId,
    mintedAt: new Date().toISOString(),
    player: player.player,
    season: player.season,
    tier: player.tier,
  };
  
  saveLedger();
  return true;
}

/**
 * Get all minted cards
 */
function getMintedCards() {
  loadLedger();
  return { ...ledger };
}

/**
 * Get minted card count
 */
function getMintedCount() {
  loadLedger();
  return Object.keys(ledger).length;
}

/**
 * Get cards minted by a specific user
 */
function getUserMintedCards(userId) {
  loadLedger();
  const userCards = [];
  
  for (const [key, data] of Object.entries(ledger)) {
    if (data.userId === userId) {
      userCards.push({ key, ...data });
    }
  }
  
  return userCards;
}

/**
 * Check availability stats
 */
function getAvailabilityStats(totalPlayers = 122522) {
  loadLedger();
  const minted = Object.keys(ledger).length;
  
  return {
    totalCards: totalPlayers,
    mintedCards: minted,
    availableCards: totalPlayers - minted,
    percentMinted: ((minted / totalPlayers) * 100).toFixed(2) + '%',
  };
}

/**
 * Reset ledger (admin only - use with caution!)
 */
function resetLedger() {
  ledger = {};
  saveLedger();
  console.log('Minting ledger has been reset');
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
