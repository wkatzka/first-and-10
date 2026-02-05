/**
 * Client-side Strategy Detection
 * ================================
 * Mirrors server-side logic for instant feedback in the swap modal.
 * This is an ESTIMATE - the server is authoritative.
 */

/**
 * Calculate average tier of a position group
 * @param {array} players - Array of player cards
 * @returns {number} - Average tier (1-11)
 */
function avgTier(players) {
  if (!players || players.length === 0) return 5;
  const sum = players.reduce((acc, p) => acc + (p?.tier || 5), 0);
  return sum / players.length;
}

/**
 * Detect offensive strategy from roster cards
 * @param {object} cards - Roster cards object with qb_card_id, rb_card_id, etc.
 * @returns {string} - 'pass_heavy', 'run_heavy', or 'balanced'
 */
export function detectOffensiveStrategy(cards) {
  if (!cards) return 'balanced';
  
  const qb = cards.qb_card_id;
  const rb = cards.rb_card_id;
  const wr1 = cards.wr1_card_id;
  const wr2 = cards.wr2_card_id;
  const ol = cards.ol_card_id;
  
  const qbTier = qb?.tier || 5;
  const wrAvgTier = avgTier([wr1, wr2].filter(Boolean));
  const rbTier = rb?.tier || 5;
  const olTier = ol?.tier || 5;
  
  // Use tier distribution for strategy detection (same as server)
  const passTierSum = qbTier + wrAvgTier;
  const runTierSum = rbTier + olTier;
  const tierRatio = passTierSum / Math.max(1, runTierSum);
  
  // Also check QB playstyle from stats if available
  const qbStats = qb?.stats || qb || {};
  const attPerGame = qbStats.att_pg || qbStats.passing_att_pg || 0;
  const rushAttPerGame = qbStats.rush_att_pg || 0;
  const rushYdsPerGame = qbStats.rush_yds_pg || 0;
  
  let qbStyle = 'BALANCED';
  if (rushYdsPerGame >= 25 && rushAttPerGame >= 4) {
    qbStyle = 'DUAL_THREAT';
  } else if (attPerGame >= 28 && (attPerGame / Math.max(1, attPerGame + rushAttPerGame)) > 0.92) {
    qbStyle = 'PASS_HEAVY';
  }
  
  // Pass-heavy: QB playstyle is PASS_HEAVY OR passing tiers significantly exceed rushing tiers
  if (qbStyle === 'PASS_HEAVY' || tierRatio > 1.20) return 'pass_heavy';
  
  // Run-heavy: QB playstyle is DUAL_THREAT OR rushing tiers significantly exceed passing tiers
  if (qbStyle === 'DUAL_THREAT' || tierRatio < 0.85) return 'run_heavy';
  
  return 'balanced';
}

/**
 * Detect defensive strategy from roster cards
 * @param {object} cards - Roster cards object with dl_card_id, lb_card_id, etc.
 * @returns {string} - 'coverage_shell', 'run_stuff', or 'base_defense'
 */
export function detectDefensiveStrategy(cards) {
  if (!cards) return 'base_defense';
  
  const dl = cards.dl_card_id;
  const lb = cards.lb_card_id;
  const db1 = cards.db1_card_id;
  const db2 = cards.db2_card_id;
  
  const dlTier = dl?.tier || 5;
  const lbTier = lb?.tier || 5;
  const dbAvgTier = avgTier([db1, db2].filter(Boolean));
  
  const coverageWeight = dbAvgTier;
  const runStuffWeight = (dlTier + lbTier) / 2;
  
  if (coverageWeight > runStuffWeight + 0.8) return 'coverage_shell';
  if (runStuffWeight > coverageWeight + 0.8) return 'run_stuff';
  return 'base_defense';
}

/**
 * Get human-readable strategy names
 */
export const STRATEGY_LABELS = {
  // Offense
  pass_heavy: 'Pass Heavy',
  balanced: 'Balanced',
  run_heavy: 'Run Heavy',
  // Defense
  coverage_shell: 'Coverage Shell',
  base_defense: 'Base Defense',
  run_stuff: 'Run Stuff',
};

/**
 * Get strategy color for UI display
 */
export const STRATEGY_COLORS = {
  // Offense
  pass_heavy: '#60a5fa', // blue
  balanced: '#a3a3a3', // gray
  run_heavy: '#4ade80', // green
  // Defense
  coverage_shell: '#60a5fa', // blue
  base_defense: '#a3a3a3', // gray
  run_stuff: '#4ade80', // green
};

/**
 * Simulate roster with a potential swap and detect resulting strategy
 * @param {object} currentCards - Current roster cards
 * @param {string} slotId - Slot being changed (e.g., 'qb_card_id')
 * @param {object} newCard - New card being placed in slot
 * @returns {object} - { offensiveStrategy, defensiveStrategy }
 */
export function detectStrategyWithSwap(currentCards, slotId, newCard) {
  // Create a copy with the swap applied
  const previewCards = { ...currentCards };
  previewCards[slotId] = newCard;
  
  return {
    offensiveStrategy: detectOffensiveStrategy(previewCards),
    defensiveStrategy: detectDefensiveStrategy(previewCards),
  };
}
