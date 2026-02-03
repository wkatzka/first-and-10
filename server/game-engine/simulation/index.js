/**
 * First & 10 - Simulation Engine
 * ================================
 * Main entry point for the game simulation.
 * 
 * Usage:
 *   const { simulateGame, buildRoster } = require('./simulation');
 *   const result = simulateGame(homeRoster, awayRoster);
 */

const { simulateGame: simulateGameCore } = require('./game');
const { calculateTeamRatings, classifyQBPlaystyle } = require('./playstyle');
const { TIERS, QB_PLAYSTYLES } = require('./constants');
const {
  DIVISIONS,
  calculatePowerScore,
  getDivision,
  getDivisionInfo,
  createLeague,
  addTeamToLeague,
  generateLeagueSchedule,
  simulateWeek,
  simulateSeason,
  getLeagueStandings,
  getDivisionStandings,
  processPromotionRelegation,
  formatStandings,
  formatPowerBreakdown,
} = require('./league');

// =============================================================================
// ROSTER BUILDING HELPERS
// =============================================================================

// Within-tier variance (0 = none). Keep this < 0.5 to ensure
// worst of tier T stays above best of tier T-1.
// Within-tier variance. This shifts a player's effective tier slightly based on
// their stat-derived traits (era-adjusted). Tune this so worst of tier T remains
// only modestly better than best of tier T-1 (target ~5% edge), while keeping
// within-tier extremes meaningfully different.
const WITHIN_TIER_MAX_OFFSET = 0.01;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function avgTraitScore(engineTraits) {
  if (!engineTraits || typeof engineTraits !== 'object') return null;
  const vals = Object.values(engineTraits)
    .map(v => (typeof v === 'number' ? v : Number(v)))
    .filter(n => Number.isFinite(n));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function effectiveTierForPlayer(p) {
  const baseTier = typeof p?.tier === 'number' ? p.tier : Number(p?.tier);
  const t = Number.isFinite(baseTier) ? baseTier : 5;

  // Prefer engine-derived traits (already era-adjusted percentiles mapped to 0-100).
  let score = avgTraitScore(p?.engine_traits);

  // Fallback to composite_score (0-100-ish in this project).
  if (score == null) {
    const cs = typeof p?.composite_score === 'number' ? p.composite_score : Number(p?.composite_score);
    if (Number.isFinite(cs)) score = clamp(cs, 0, 100);
  }

  if (score == null) score = 50;
  const offset = WITHIN_TIER_MAX_OFFSET * ((score - 50) / 50);
  return clamp(t + offset, 1, 10);
}

function applyEffectiveTiersToRoster(roster) {
  if (!roster) return roster;
  const clonePlayer = (p) => {
    if (!p) return p;
    const eff = effectiveTierForPlayer(p);
    return { ...p, tier_base: p.tier, tier: eff };
  };
  const cloneArr = (arr) => (Array.isArray(arr) ? arr.map(clonePlayer) : arr);
  return {
    ...roster,
    QB: clonePlayer(roster.QB),
    TE: clonePlayer(roster.TE),
    K: clonePlayer(roster.K),
    P: clonePlayer(roster.P),
    RBs: cloneArr(roster.RBs),
    WRs: cloneArr(roster.WRs),
    OLs: cloneArr(roster.OLs),
    DLs: cloneArr(roster.DLs),
    LBs: cloneArr(roster.LBs),
    DBs: cloneArr(roster.DBs),
  };
}

/**
 * Simulation wrapper that applies within-tier variance.
 */
function simulateGame(homeRoster, awayRoster, options) {
  const home = applyEffectiveTiersToRoster(homeRoster);
  const away = applyEffectiveTiersToRoster(awayRoster);
  return simulateGameCore(home, away, options);
}

/**
 * Build a roster object from an array of player cards
 * @param {array} players - Array of player cards with pos_group field
 * @returns {object} - Structured roster
 */
function buildRoster(players) {
  const roster = {
    QB: null,
    RBs: [],
    WRs: [],
    TE: null,
    OLs: [],
    DLs: [],
    LBs: [],
    DBs: [],
    K: null,
    P: null,
  };
  
  for (const player of players) {
    const pos = player.pos_group || player.position || 'UNKNOWN';
    
    switch (pos) {
      case 'QB':
        if (!roster.QB) roster.QB = player;
        break;
      case 'RB':
        roster.RBs.push(player);
        break;
      case 'WR':
        roster.WRs.push(player);
        break;
      case 'TE':
        if (!roster.TE) roster.TE = player;
        break;
      case 'OL':
        roster.OLs.push(player);
        break;
      case 'DL':
        roster.DLs.push(player);
        break;
      case 'LB':
        roster.LBs.push(player);
        break;
      case 'DB':
        roster.DBs.push(player);
        break;
      case 'K':
        if (!roster.K) roster.K = player;
        break;
      case 'P':
        if (!roster.P) roster.P = player;
        break;
    }
  }
  
  return roster;
}

/**
 * Create a roster with placeholder players at specified tiers
 * Useful for testing tier matchups
 * @param {object} tiers - Object with position: tier mappings
 * @returns {object} - Roster with placeholder players
 */
function createTestRoster(tiers = {}) {
  const defaultTier = 5;
  
  return {
    QB: { player: 'Test QB', tier: tiers.QB || defaultTier, pos_group: 'QB' },
    RBs: [
      { player: 'Test RB1', tier: tiers.RB || defaultTier, pos_group: 'RB' },
      { player: 'Test RB2', tier: tiers.RB || defaultTier, pos_group: 'RB' },
    ],
    WRs: [
      { player: 'Test WR1', tier: tiers.WR || defaultTier, pos_group: 'WR' },
      { player: 'Test WR2', tier: tiers.WR || defaultTier, pos_group: 'WR' },
      { player: 'Test WR3', tier: tiers.WR || defaultTier, pos_group: 'WR' },
    ],
    TE: { player: 'Test TE', tier: tiers.TE || defaultTier, pos_group: 'TE' },
    OLs: [
      { player: 'Test OL1', tier: tiers.OL || defaultTier, pos_group: 'OL' },
      { player: 'Test OL2', tier: tiers.OL || defaultTier, pos_group: 'OL' },
      { player: 'Test OL3', tier: tiers.OL || defaultTier, pos_group: 'OL' },
      { player: 'Test OL4', tier: tiers.OL || defaultTier, pos_group: 'OL' },
      { player: 'Test OL5', tier: tiers.OL || defaultTier, pos_group: 'OL' },
    ],
    DLs: [
      { player: 'Test DL1', tier: tiers.DL || defaultTier, pos_group: 'DL' },
      { player: 'Test DL2', tier: tiers.DL || defaultTier, pos_group: 'DL' },
      { player: 'Test DL3', tier: tiers.DL || defaultTier, pos_group: 'DL' },
      { player: 'Test DL4', tier: tiers.DL || defaultTier, pos_group: 'DL' },
    ],
    LBs: [
      { player: 'Test LB1', tier: tiers.LB || defaultTier, pos_group: 'LB' },
      { player: 'Test LB2', tier: tiers.LB || defaultTier, pos_group: 'LB' },
      { player: 'Test LB3', tier: tiers.LB || defaultTier, pos_group: 'LB' },
    ],
    DBs: [
      { player: 'Test DB1', tier: tiers.DB || defaultTier, pos_group: 'DB' },
      { player: 'Test DB2', tier: tiers.DB || defaultTier, pos_group: 'DB' },
      { player: 'Test DB3', tier: tiers.DB || defaultTier, pos_group: 'DB' },
      { player: 'Test DB4', tier: tiers.DB || defaultTier, pos_group: 'DB' },
    ],
    K: { player: 'Test K', tier: tiers.K || defaultTier, pos_group: 'K' },
    P: { player: 'Test P', tier: tiers.P || defaultTier, pos_group: 'P' },
  };
}

/**
 * Get team summary for display
 */
function getTeamSummary(roster) {
  const ratings = calculateTeamRatings(roster);
  const qbStyle = roster.QB ? classifyQBPlaystyle(roster.QB) : 'BALANCED';
  
  return {
    qb: roster.QB?.player || 'None',
    qbTier: roster.QB?.tier || 0,
    qbStyle: QB_PLAYSTYLES[qbStyle]?.name || qbStyle,
    passRating: ratings.offense.passRating.toFixed(1),
    runRating: ratings.offense.runRating.toFixed(1),
    passDefense: ratings.defense.passDefenseRating.toFixed(1),
    runDefense: ratings.defense.runDefenseRating.toFixed(1),
    overall: ratings.overall.total.toFixed(1),
  };
}

/**
 * Format game result for display
 */
function formatGameResult(result) {
  const lines = [];
  
  lines.push('='.repeat(60));
  lines.push('FINAL SCORE');
  lines.push('='.repeat(60));
  lines.push(`Home: ${result.homeScore}  |  Away: ${result.awayScore}`);
  lines.push(`Winner: ${result.winner.toUpperCase()}`);
  lines.push('');
  
  lines.push('HOME STATS');
  lines.push('-'.repeat(40));
  lines.push(`Passing Yards: ${result.homeStats.passingYards}`);
  lines.push(`Rushing Yards: ${result.homeStats.rushingYards}`);
  lines.push(`Total Yards: ${result.homeStats.totalYards}`);
  lines.push(`First Downs: ${result.homeStats.firstDowns}`);
  lines.push(`Turnovers: ${result.homeStats.interceptions + result.homeStats.fumbles}`);
  lines.push(`Time of Possession: ${Math.floor(result.homeStats.timeOfPossession / 60)}:${String(Math.floor(result.homeStats.timeOfPossession % 60)).padStart(2, '0')}`);
  lines.push('');
  
  lines.push('AWAY STATS');
  lines.push('-'.repeat(40));
  lines.push(`Passing Yards: ${result.awayStats.passingYards}`);
  lines.push(`Rushing Yards: ${result.awayStats.rushingYards}`);
  lines.push(`Total Yards: ${result.awayStats.totalYards}`);
  lines.push(`First Downs: ${result.awayStats.firstDowns}`);
  lines.push(`Turnovers: ${result.awayStats.interceptions + result.awayStats.fumbles}`);
  lines.push(`Time of Possession: ${Math.floor(result.awayStats.timeOfPossession / 60)}:${String(Math.floor(result.awayStats.timeOfPossession % 60)).padStart(2, '0')}`);
  
  return lines.join('\n');
}

/**
 * Format play-by-play for display
 */
function formatPlayByPlay(result, limit = 50) {
  const lines = [];
  
  lines.push('='.repeat(60));
  lines.push('PLAY BY PLAY');
  lines.push('='.repeat(60));
  
  const plays = result.plays.slice(0, limit);
  
  for (const play of plays) {
    const possession = play.possession === 'home' ? 'HOME' : 'AWAY';
    const situation = play.down ? `${play.down}&${play.yardsToGo} at ${play.fieldPosition}` : '';
    lines.push(`Q${play.quarter} ${play.time} | ${possession} | ${situation}`);
    lines.push(`  ${play.description}`);
  }
  
  if (result.plays.length > limit) {
    lines.push(`  ... and ${result.plays.length - limit} more plays`);
  }
  
  return lines.join('\n');
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Core simulation
  simulateGame,
  
  // Roster building
  buildRoster,
  createTestRoster,
  
  // Analysis
  calculateTeamRatings,
  classifyQBPlaystyle,
  getTeamSummary,
  
  // Display
  formatGameResult,
  formatPlayByPlay,
  
  // Constants
  TIERS,
  QB_PLAYSTYLES,
  DIVISIONS,
  
  // League system
  calculatePowerScore,
  getDivision,
  getDivisionInfo,
  createLeague,
  addTeamToLeague,
  generateLeagueSchedule,
  simulateWeek,
  simulateSeason,
  getLeagueStandings,
  getDivisionStandings,
  processPromotionRelegation,
  formatStandings,
  formatPowerBreakdown,
};
