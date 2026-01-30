/**
 * Pack Opening System
 * ====================
 * Tier-weighted random player selection from the normalized data
 */

const fs = require('fs');
const path = require('path');
const { isCardMinted, mintCard, getAvailabilityStats } = require('./minting-ledger');

// Load normalized players
const PLAYERS_PATH = path.join(__dirname, './game-engine/data/normalized_players.json');
let allPlayers = null;
let playersByTier = {};
let playersByPosition = {};

function loadPlayers() {
  if (allPlayers) return allPlayers;
  
  const raw = fs.readFileSync(PLAYERS_PATH, 'utf-8');
  const rawPlayers = JSON.parse(raw);
  
  // Normalize player data - map pos_group to position
  allPlayers = rawPlayers.map(p => ({
    ...p,
    position: p.pos_group || p.pos || 'Unknown',  // Use pos_group as canonical position
  }));
  
  // Index by tier
  playersByTier = {};
  for (let i = 1; i <= 10; i++) {
    playersByTier[i] = [];
  }
  
  // Index by position
  playersByPosition = {
    QB: [], RB: [], WR: [], TE: [], OL: [], DL: [], LB: [], DB: [], K: [], P: []
  };
  
  for (const player of allPlayers) {
    const tier = player.tier || 1;
    if (playersByTier[tier]) {
      playersByTier[tier].push(player);
    }
    
    const pos = player.position;
    if (playersByPosition[pos]) {
      playersByPosition[pos].push(player);
    }
  }
  
  console.log(`Loaded ${allPlayers.length} players`);
  for (let i = 10; i >= 1; i--) {
    console.log(`  Tier ${i}: ${playersByTier[i].length} players`);
  }
  
  // Log position distribution
  console.log('Position distribution:');
  for (const [pos, players] of Object.entries(playersByPosition)) {
    console.log(`  ${pos}: ${players.length}`);
  }
  
  return allPlayers;
}

// Tier weights for pack opening (lower tiers more common)
// These are relative weights, not percentages
const TIER_WEIGHTS = {
  10: 1,      // Legendary - very rare
  9: 3,       // Epic
  8: 7,       // Ultra Rare
  7: 12,      // Very Rare
  6: 18,      // Rare
  5: 22,      // Uncommon+
  4: 20,      // Uncommon
  3: 10,      // Common+
  2: 5,       // Common
  1: 2,       // Basic
};

// Calculate total weight
const TOTAL_WEIGHT = Object.values(TIER_WEIGHTS).reduce((a, b) => a + b, 0);

/**
 * Pick a random tier based on weights
 */
function pickRandomTier() {
  const roll = Math.random() * TOTAL_WEIGHT;
  let cumulative = 0;
  
  for (let tier = 1; tier <= 10; tier++) {
    cumulative += TIER_WEIGHTS[tier];
    if (roll < cumulative) {
      return tier;
    }
  }
  
  return 5; // Fallback
}

/**
 * Pick a random AVAILABLE player from a specific tier
 * Only returns players that haven't been minted yet
 */
function pickRandomPlayerFromTier(tier, maxAttempts = 100) {
  loadPlayers();
  
  const tierPlayers = playersByTier[tier];
  if (!tierPlayers || tierPlayers.length === 0) {
    // Fallback to finding any available player
    return pickAnyAvailablePlayer();
  }
  
  // Try to find an unminted player in this tier
  for (let i = 0; i < maxAttempts; i++) {
    const player = tierPlayers[Math.floor(Math.random() * tierPlayers.length)];
    if (!isCardMinted(player)) {
      return player;
    }
  }
  
  // If we couldn't find one randomly, scan the whole tier
  const available = tierPlayers.filter(p => !isCardMinted(p));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  
  // Tier exhausted, try adjacent tiers
  for (let t = tier - 1; t >= 1; t--) {
    const fallback = playersByTier[t]?.filter(p => !isCardMinted(p));
    if (fallback && fallback.length > 0) {
      return fallback[Math.floor(Math.random() * fallback.length)];
    }
  }
  for (let t = tier + 1; t <= 10; t++) {
    const fallback = playersByTier[t]?.filter(p => !isCardMinted(p));
    if (fallback && fallback.length > 0) {
      return fallback[Math.floor(Math.random() * fallback.length)];
    }
  }
  
  return null; // All cards minted!
}

/**
 * Pick any available (unminted) player
 */
function pickAnyAvailablePlayer() {
  loadPlayers();
  
  // Shuffle and find first unminted
  const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
  for (const player of shuffled.slice(0, 1000)) {
    if (!isCardMinted(player)) {
      return player;
    }
  }
  
  // Full scan if needed
  const available = allPlayers.filter(p => !isCardMinted(p));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  
  return null;
}

/**
 * Pick a random AVAILABLE player from a specific position
 */
function pickRandomPlayerFromPosition(position, maxAttempts = 100) {
  loadPlayers();
  
  const posPlayers = playersByPosition[position];
  if (!posPlayers || posPlayers.length === 0) {
    return null;
  }
  
  // Try random picks first
  for (let i = 0; i < maxAttempts; i++) {
    const player = posPlayers[Math.floor(Math.random() * posPlayers.length)];
    if (!isCardMinted(player)) {
      return player;
    }
  }
  
  // Scan for any available at this position
  const available = posPlayers.filter(p => !isCardMinted(p));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  
  return null; // Position exhausted
}

/**
 * Open a pack of cards
 * Returns 5 random AVAILABLE players with tier-weighted selection
 */
function openPack() {
  loadPlayers();
  
  const cards = [];
  
  for (let i = 0; i < 5; i++) {
    const tier = pickRandomTier();
    const player = pickRandomPlayerFromTier(tier);
    
    if (player) {
      cards.push({
        ...player,
        pack_position: i + 1,
      });
    }
  }
  
  // If we couldn't get 5 cards, try to fill with any available
  while (cards.length < 5) {
    const player = pickAnyAvailablePlayer();
    if (!player) break; // No more cards available
    cards.push({
      ...player,
      pack_position: cards.length + 1,
    });
  }
  
  return cards;
}

/**
 * Starter pack position assignments
 * Guarantees ALL 11 roster positions across 3 starter packs:
 * - Pack 1 (packNum 0): QB, RB, WR, TE, OL
 * - Pack 2 (packNum 1): DL, LB, DB, DB, K
 * - Pack 3 (packNum 2): WR (2nd), + 4 random bonus cards
 */
const STARTER_PACK_POSITIONS = {
  0: ['QB', 'RB', 'WR', 'TE', 'OL'],    // Pack 1: Core offense
  1: ['DL', 'LB', 'DB', 'DB', 'K'],      // Pack 2: Defense + kicker
  2: ['WR', null, null, null, null],     // Pack 3: 2nd WR + randoms
};

/**
 * Open a starter pack (guaranteed positions for a balanced start)
 * Ensures ALL 11 roster positions are covered across 3 starter packs
 * Only returns AVAILABLE (unminted) cards
 * @param {number} packNum - Which starter pack (0, 1, or 2)
 */
function openStarterPack(packNum = 0) {
  loadPlayers();
  
  const cards = [];
  
  // Helper to find available player at position and tier range
  const findAvailableAtPosition = (position, minTier = 4, maxTier = 7) => {
    for (let tier = minTier; tier <= maxTier; tier++) {
      const tierPlayers = playersByTier[tier]?.filter(p => p.position === position && !isCardMinted(p));
      if (tierPlayers && tierPlayers.length > 0) {
        return tierPlayers[Math.floor(Math.random() * tierPlayers.length)];
      }
    }
    // Fallback to any tier at this position
    return pickRandomPlayerFromPosition(position);
  };
  
  // Get position requirements for this pack
  const positions = STARTER_PACK_POSITIONS[packNum] || STARTER_PACK_POSITIONS[0];
  
  for (const position of positions) {
    if (position) {
      // Guaranteed position card
      const player = findAvailableAtPosition(position, 4, 7);
      if (player) cards.push(player);
    } else {
      // Random card (null means random)
      const randomTier = pickRandomTier();
      const player = pickRandomPlayerFromTier(randomTier);
      if (player) cards.push(player);
    }
  }
  
  // Fill remaining slots if we couldn't get all 5
  while (cards.length < 5) {
    const filler = pickAnyAvailablePlayer();
    if (!filler) break;
    cards.push(filler);
  }
  
  return cards.map((card, i) => ({ ...card, pack_position: i + 1 }));
}

/**
 * Get pack opening statistics
 */
function getPackStats() {
  loadPlayers();
  
  return {
    totalPlayers: allPlayers.length,
    byTier: Object.fromEntries(
      Object.entries(playersByTier).map(([tier, players]) => [tier, players.length])
    ),
    byPosition: Object.fromEntries(
      Object.entries(playersByPosition).map(([pos, players]) => [pos, players.length])
    ),
    weights: TIER_WEIGHTS,
    expectedRates: Object.fromEntries(
      Object.entries(TIER_WEIGHTS).map(([tier, weight]) => [
        tier,
        ((weight / TOTAL_WEIGHT) * 100).toFixed(2) + '%'
      ])
    ),
  };
}

/**
 * Search for specific players (for testing/admin)
 */
function searchPlayers(query, limit = 20) {
  loadPlayers();
  
  const lowerQuery = query.toLowerCase();
  
  return allPlayers
    .filter(p => p.player.toLowerCase().includes(lowerQuery))
    .slice(0, limit);
}

/**
 * Get a specific player by key
 */
function getPlayerByKey(playerKey) {
  loadPlayers();
  
  return allPlayers.find(p => 
    `${p.player}_${p.season}` === playerKey || 
    p.player_key === playerKey
  );
}

module.exports = {
  loadPlayers,
  openPack,
  openStarterPack,
  pickRandomTier,
  pickRandomPlayerFromTier,
  pickRandomPlayerFromPosition,
  pickAnyAvailablePlayer,
  getPackStats,
  searchPlayers,
  getPlayerByKey,
  getAvailabilityStats,
  TIER_WEIGHTS,
};
