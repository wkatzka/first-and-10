/**
 * QB Playstyle Classification & Team Chemistry
 * =============================================
 * Determines QB type and calculates offensive synergies.
 */

const {
  QB_PLAYSTYLES,
  tierToRating,
  DEFENSIVE_STRATEGIES,
  STRATEGY_MATCHUP_MODIFIERS,
  STRATEGY_BOOST_AMOUNT,
  OFFENSE_STRATEGY_BOOSTS,
  DEFENSE_STRATEGY_BOOSTS,
  STRATEGY_AFFECTED_POSITIONS,
} = require('./constants');

// =============================================================================
// QB PLAYSTYLE CLASSIFICATION
// =============================================================================

/**
 * Classify a QB's playstyle based on their stats
 * @param {object} qb - QB player card with stats
 * @returns {string} - Playstyle key: PASS_HEAVY, DUAL_THREAT, BALANCED, GAME_MANAGER
 */
function classifyQBPlaystyle(qb) {
  // Get relevant stats (with fallbacks)
  const attPerGame = qb.att_pg || qb.passing_att_pg || 0;
  const rushAttPerGame = qb.rush_att_pg || 0;
  const rushYdsPerGame = qb.rush_yds_pg || 0;
  const passingYards = qb.yds_pg || qb.passing_yds_pg || 0;
  
  // If no meaningful stats, default to BALANCED (don't use GAME_MANAGER which has biased weights)
  if (attPerGame < 5 && rushYdsPerGame < 5) {
    return 'BALANCED';
  }
  
  // Calculate ratios
  const totalAttempts = attPerGame + rushAttPerGame;
  const passRatio = totalAttempts > 0 ? attPerGame / totalAttempts : 0.9;
  
  // Dual-threat: significant rushing ability
  if (rushYdsPerGame >= 25 && rushAttPerGame >= 4) {
    return 'DUAL_THREAT';
  }
  
  // Pass-heavy: high volume, low rushing
  if (passRatio > 0.92 && attPerGame >= 28) {
    return 'PASS_HEAVY';
  }
  
  // Game manager: low volume but efficient (must have SOME attempts to qualify)
  if (attPerGame >= 15 && attPerGame < 25 && passRatio > 0.85) {
    return 'GAME_MANAGER';
  }
  
  // Default: balanced
  return 'BALANCED';
}

/**
 * Get playstyle config for a QB
 */
function getPlaystyleConfig(qb) {
  const style = classifyQBPlaystyle(qb);
  return {
    style,
    config: QB_PLAYSTYLES[style],
  };
}

// =============================================================================
// STRATEGY RATING BOOSTS
// =============================================================================

/**
 * Determine the strategy matchup result for offense
 * @param {string} myOffense - My offensive strategy (pass_heavy, balanced, run_heavy)
 * @param {string} theirDefense - Opponent's defensive strategy
 * @returns {string} - 'advantage', 'captured', or 'neutral'
 */
function getOffenseMatchupResult(myOffense, theirDefense) {
  return OFFENSE_STRATEGY_BOOSTS[myOffense]?.[theirDefense] || 'neutral';
}

/**
 * Determine the strategy matchup result for defense
 * @param {string} myDefense - My defensive strategy
 * @param {string} theirOffense - Opponent's offensive strategy
 * @returns {string} - 'advantage', 'captured', or 'neutral'
 */
function getDefenseMatchupResult(myDefense, theirOffense) {
  return DEFENSE_STRATEGY_BOOSTS[myDefense]?.[theirOffense] || 'neutral';
}

/**
 * Get rating multiplier based on matchup result
 * @param {string} result - 'advantage', 'captured', or 'neutral'
 * @returns {number} - Rating multiplier (e.g., 1.05, 0.95, or 1.0)
 */
function getBoostMultiplier(result) {
  if (result === 'advantage') return 1 + STRATEGY_BOOST_AMOUNT;
  if (result === 'captured') return 1 - STRATEGY_BOOST_AMOUNT;
  return 1.0;
}

/**
 * Get position-specific rating multipliers based on strategy matchup
 * @param {string} myOffense - My offensive strategy
 * @param {string} myDefense - My defensive strategy
 * @param {string} theirOffense - Opponent's offensive strategy
 * @param {string} theirDefense - Opponent's defensive strategy
 * @returns {object} - { QB: mult, WR: mult, RB: mult, ... }
 */
function getStrategyRatingMultipliers(myOffense, myDefense, theirOffense, theirDefense) {
  const multipliers = {
    QB: 1.0, WR: 1.0, RB: 1.0, TE: 1.0, OL: 1.0,
    DL: 1.0, LB: 1.0, DB: 1.0, K: 1.0, P: 1.0,
  };

  // Offensive matchup: my offense vs their defense
  const offResult = getOffenseMatchupResult(myOffense, theirDefense);
  const offMult = getBoostMultiplier(offResult);
  const affectedOffPositions = STRATEGY_AFFECTED_POSITIONS.offense[myOffense] || [];
  for (const pos of affectedOffPositions) {
    multipliers[pos] = offMult;
  }

  // Defensive matchup: my defense vs their offense
  const defResult = getDefenseMatchupResult(myDefense, theirOffense);
  const defMult = getBoostMultiplier(defResult);
  const affectedDefPositions = STRATEGY_AFFECTED_POSITIONS.defense[myDefense] || [];
  for (const pos of affectedDefPositions) {
    multipliers[pos] = defMult;
  }

  return multipliers;
}

/**
 * Get boosted rating for a player based on position multiplier
 * @param {object} player - Player card with tier
 * @param {number} multiplier - Rating multiplier (e.g., 1.05)
 * @returns {number} - Boosted rating
 */
function getBoostedRating(player, multiplier = 1.0) {
  const tier = player?.tier || 5;
  const baseRating = tierToRating(tier);
  return baseRating * multiplier;
}

/**
 * Calculate average boosted rating for a position group
 * @param {array} players - Array of player cards
 * @param {number} multiplier - Rating multiplier
 * @returns {number} - Average boosted rating (0-1.1 scale)
 */
function avgBoostedRating(players, multiplier = 1.0) {
  if (!players || players.length === 0) return tierToRating(5);
  const sum = players.reduce((acc, p) => acc + getBoostedRating(p, multiplier), 0);
  return sum / players.length;
}

// =============================================================================
// TEAM RATINGS CALCULATION
// =============================================================================

/**
 * Calculate average tier of a position group
 * @param {array} players - Array of player cards
 * @returns {number} - Average tier (1-11)
 */
function avgTier(players) {
  if (!players || players.length === 0) return 5; // Default to middle tier
  const sum = players.reduce((acc, p) => acc + (p.tier || 5), 0);
  return sum / players.length;
}

/**
 * Calculate offensive ratings considering QB playstyle synergies and strategy boosts
 * Updated for 11-slot roster: single RB, single OL (WRs still array of 2)
 * @param {object} roster - Full team roster
 * @param {object} ratingMults - Optional position rating multipliers from strategy matchup
 * @returns {object} - Offensive ratings
 */
function calculateOffensiveRatings(roster, ratingMults = null) {
  const qb = roster.QB;
  if (!qb) {
    return { passRating: 5, runRating: 5, style: 'BALANCED', config: QB_PLAYSTYLES.BALANCED };
  }
  
  const { style, config } = getPlaystyleConfig(qb);
  
  // Get rating multipliers (default to 1.0 if not provided)
  const mults = ratingMults || { QB: 1.0, WR: 1.0, RB: 1.0, TE: 1.0, OL: 1.0 };
  
  // Calculate boosted ratings (0-1.1 scale) instead of raw tiers
  // Handle both old (array) and new (single player) roster formats
  const qbRating = getBoostedRating(qb, mults.QB);
  const wrAvgRating = avgBoostedRating(roster.WRs || [], mults.WR);
  const rbRating = roster.RB 
    ? getBoostedRating(roster.RB, mults.RB) 
    : avgBoostedRating(roster.RBs || [], mults.RB); // fallback for old format
  const teRating = getBoostedRating(roster.TE, mults.TE);
  const olRating = roster.OL 
    ? getBoostedRating(roster.OL, mults.OL)
    : avgBoostedRating(roster.OLs || [], mults.OL); // fallback for old format
  
  // Keep tier values for synergy checks (use base tiers, not boosted)
  const qbTier = qb.tier || 5;
  const wrAvgTier = avgTier(roster.WRs || []);
  const rbTier = roster.RB?.tier || avgTier(roster.RBs || []) || 5;
  const teAvgTier = roster.TE?.tier || 5;
  const olTier = roster.OL?.tier || avgTier(roster.OLs || []) || 5;
  
  // Calculate pass game rating using boosted ratings (scale to 1-12 range)
  // Rating is 0-1.1, multiply by 12 to get 0-13.2 range, similar to tier-based calc
  let passRating = (qbRating * 12 * config.qbDependency) + (wrAvgRating * 12 * config.wrDependency);
  
  // Apply synergy bonuses/penalties based on base tiers
  if (wrAvgTier >= 7) {
    passRating *= config.wrSynergyBonus;
  } else if (wrAvgTier <= 3) {
    passRating *= config.wrSynergyPenalty;
  }
  
  // TE adds small bonus
  passRating += (teRating * 12 - 5) * 0.1;
  
  // OL affects time in pocket
  const protectionRating = olRating * 12;
  
  // Calculate run game rating using boosted ratings
  let runRating = (rbRating * 12) * 0.5 + (olRating * 12) * 0.5;
  
  // Dual-threat QB contributes to run game
  if (config.rushContribution > 0) {
    runRating = runRating * (1 - config.rushContribution) + (qbRating * 12) * config.rushContribution;
  }
  
  // TE blocking helps run game slightly
  runRating += (teRating * 12 - 5) * 0.05;
  
  return {
    passRating: Math.max(1, Math.min(13, passRating)),  // Cap at 1-13 (allows for T11 + boost)
    runRating: Math.max(1, Math.min(13, runRating)),
    protectionRating,
    qbTier,
    wrAvgTier,
    rbTier,
    teAvgTier,
    olTier,
    style,
    config,
    // Include boost info for display
    ratingMults: mults,
  };
}

/**
 * Calculate defensive ratings with optional strategy boosts
 * Updated for 11-slot roster: single DL, single LB (DBs still array of 2)
 * @param {object} roster - Full team roster
 * @param {object} ratingMults - Optional position rating multipliers from strategy matchup
 * @returns {object} - Defensive ratings
 */
function calculateDefensiveRatings(roster, ratingMults = null) {
  // Get rating multipliers (default to 1.0 if not provided)
  const mults = ratingMults || { DL: 1.0, LB: 1.0, DB: 1.0 };
  
  // Calculate boosted ratings (0-1.1 scale)
  // Handle both old (array) and new (single player) roster formats
  const dlRating = roster.DL 
    ? getBoostedRating(roster.DL, mults.DL)
    : avgBoostedRating(roster.DLs || [], mults.DL); // fallback for old format
  const lbRating = roster.LB
    ? getBoostedRating(roster.LB, mults.LB)
    : avgBoostedRating(roster.LBs || [], mults.LB); // fallback for old format
  const dbAvgRating = avgBoostedRating(roster.DBs || [], mults.DB);
  
  // Keep tier values for strategy derivation
  const dlTier = roster.DL?.tier || avgTier(roster.DLs || []) || 5;
  const lbTier = roster.LB?.tier || avgTier(roster.LBs || []) || 5;
  const dbAvgTier = avgTier(roster.DBs || []) || 5;
  
  // Scale ratings to tier-equivalent (multiply by ~12 to match old scale)
  const dlScaled = dlRating * 12;
  const lbScaled = lbRating * 12;
  const dbScaled = dbAvgRating * 12;
  
  // Pass defense: DBs most important, then pass rush
  const passDefenseRating = dbScaled * 0.50 + dlScaled * 0.30 + lbScaled * 0.20;
  
  // Run defense: DL and LB equally important
  const runDefenseRating = dlScaled * 0.40 + lbScaled * 0.40 + dbScaled * 0.20;
  
  // Pass rush rating (affects sacks and pressure)
  const passRushRating = dlScaled * 0.70 + lbScaled * 0.30;
  
  // Coverage rating
  const coverageRating = dbScaled * 0.70 + lbScaled * 0.30;
  
  return {
    passDefenseRating,
    runDefenseRating,
    passRushRating,
    coverageRating,
    dlAvgTier: dlTier,   // Keep old name for compatibility
    lbAvgTier: lbTier,
    dbAvgTier,
    // Include boost info for display
    ratingMults: mults,
  };
}

/**
 * Calculate special teams ratings
 * @param {object} roster - Full team roster
 * @returns {object} - Special teams ratings
 */
function calculateSpecialTeamsRatings(roster) {
  const kTier = roster.K?.tier || 5;
  const pTier = roster.P?.tier || 5;
  
  // Kicker rating affects FG accuracy
  const kickerRating = kTier;
  
  // Punter rating affects punt distance and hangtime
  const punterRating = pTier;
  
  return {
    kickerRating,
    punterRating,
  };
}

/**
 * Calculate full team ratings with optional strategy boosts
 * @param {object} roster - Full team roster
 * @param {object} strategyContext - Optional { myOffense, myDefense, theirOffense, theirDefense }
 * @returns {object} - All team ratings
 */
function calculateTeamRatings(roster, strategyContext = null) {
  // Get position rating multipliers if strategy context provided
  let ratingMults = null;
  let matchupResults = null;
  
  if (strategyContext?.myOffense && strategyContext?.theirDefense) {
    ratingMults = getStrategyRatingMultipliers(
      strategyContext.myOffense,
      strategyContext.myDefense,
      strategyContext.theirOffense,
      strategyContext.theirDefense
    );
    matchupResults = {
      offense: getOffenseMatchupResult(strategyContext.myOffense, strategyContext.theirDefense),
      defense: getDefenseMatchupResult(strategyContext.myDefense, strategyContext.theirOffense),
    };
  }
  
  const offense = calculateOffensiveRatings(roster, ratingMults);
  const defense = calculateDefensiveRatings(roster, ratingMults);
  const specialTeams = calculateSpecialTeamsRatings(roster);
  
  // Overall rating (for display/comparison)
  const overallOffense = (offense.passRating + offense.runRating) / 2;
  const overallDefense = (defense.passDefenseRating + defense.runDefenseRating) / 2;
  const overall = (overallOffense + overallDefense) / 2;
  
  return {
    offense,
    defense,
    specialTeams,
    overall: {
      offense: overallOffense,
      defense: overallDefense,
      total: overall,
    },
    // Strategy matchup results for display
    strategyMatchup: matchupResults,
  };
}

// =============================================================================
// PLAY CALLING TENDENCIES
// =============================================================================

/**
 * Determine base pass/run tendency for a team
 * @param {object} offenseRatings - Calculated offense ratings
 * @param {object} defenseRatings - Opponent's defense ratings
 * @param {object} strategyContext - Optional { offensiveStrategy, defensiveStrategy } for matchup adjustment
 * @returns {number} - Pass frequency (0-1)
 */
function getPassTendency(offenseRatings, opponentDefense, strategyContext = null) {
  const { config, passRating, runRating } = offenseRatings;
  
  let passTendency = config.passFrequency;
  
  // Adjust based on strength differential (stats layer: tier-derived ratings)
  const passAdvantage = passRating - opponentDefense.passDefenseRating;
  const runAdvantage = runRating - opponentDefense.runDefenseRating;
  
  // Lean towards the better matchup
  if (passAdvantage > runAdvantage + 1) {
    passTendency += 0.08;
  } else if (runAdvantage > passAdvantage + 1) {
    passTendency -= 0.08;
  }
  
  // Strategy matchup: slight play-call adjustment when defense has an edge (tuned for ~+10% advantage)
  if (strategyContext?.offensiveStrategy && strategyContext?.defensiveStrategy) {
    const mods = STRATEGY_MATCHUP_MODIFIERS[strategyContext.defensiveStrategy]?.[strategyContext.offensiveStrategy];
    if (mods) {
      if (mods.pass < 0.97) passTendency -= 0.02; // defense strong vs pass
      if (mods.run < 0.97) passTendency += 0.02;  // defense strong vs run
    }
  }
  
  // Cap between 0.35 and 0.75
  return Math.max(0.35, Math.min(0.75, passTendency));
}

// =============================================================================
// STRATEGY DERIVATION (from stats layer)
// =============================================================================
// Offensive strategy is derived from QB playstyle (att_pg, rush_yds_pg, etc.) and from
// passRating vs runRating (which come from QB/WR/TE/OL and RB/OL tiers + engine_traits).
// Defensive strategy is derived from position-tier composition: DB-heavy → coverage_shell,
// DL/LB-heavy → run_stuff, else base_defense. So the same stats that drive ratings and
// matchup outcomes (tiers, composite_score, engine_traits) also drive which strategy each
// team "plays," and the rock-paper-scissors table then modulates play-calling tendency
// and per-play yardage multipliers on top of those base outcomes.
function getOffensiveStrategyFromRatings(offenseRatings) {
  if (!offenseRatings) return 'balanced';
  const { style, qbTier, wrAvgTier, rbTier, olTier } = offenseRatings;
  
  // PRIMARY: Use TIER distribution for strategy detection (more reliable than ratings)
  // This prevents synergy bonuses and config weights from falsely biasing detection
  const passTierSum = (qbTier || 5) + (wrAvgTier || 5);
  const runTierSum = (rbTier || 5) + (olTier || 5);
  const tierRatio = passTierSum / Math.max(1, runTierSum);
  
  // SECONDARY: Consider QB playstyle for extreme cases
  // Pass-heavy: QB playstyle is PASS_HEAVY OR passing tiers significantly exceed rushing tiers
  if (style === 'PASS_HEAVY' || tierRatio > 1.20) return 'pass_heavy';
  
  // Run-heavy: QB playstyle is DUAL_THREAT OR rushing tiers significantly exceed passing tiers
  if (style === 'DUAL_THREAT' || tierRatio < 0.85) return 'run_heavy';
  
  return 'balanced';
}

/**
 * Derive defensive strategy from roster composition (stats layer: position tiers).
 * Coverage Shell = DB-heavy (good vs pass); Run Stuff = DL/LB emphasis (good vs run); Base = balanced.
 */
function getDefensiveStrategyFromRatings(defenseRatings) {
  if (!defenseRatings) return 'base_defense';
  const { dbAvgTier, dlAvgTier, lbAvgTier } = defenseRatings;
  const dbT = dbAvgTier ?? 5;
  const dlT = dlAvgTier ?? 5;
  const lbT = lbAvgTier ?? 5;
  const coverageWeight = dbT;
  const runStuffWeight = (dlT + lbT) / 2;
  if (coverageWeight > runStuffWeight + 0.8) return 'coverage_shell';
  if (runStuffWeight > coverageWeight + 0.8) return 'run_stuff';
  return 'base_defense';
}

/**
 * Get strategy matchup modifier for a play type (multiplier for yards/effectiveness).
 * Uses STRATEGY_MATCHUP_MODIFIERS from constants (rock-paper-scissors table).
 */
function getStrategyMatchupModifier(offensiveStrategy, defensiveStrategy, playType) {
  const mods = STRATEGY_MATCHUP_MODIFIERS[defensiveStrategy]?.[offensiveStrategy];
  if (!mods) return 1.0;
  return playType === 'pass' ? mods.pass : mods.run;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  classifyQBPlaystyle,
  getPlaystyleConfig,
  avgTier,
  calculateOffensiveRatings,
  calculateDefensiveRatings,
  calculateSpecialTeamsRatings,
  calculateTeamRatings,
  getPassTendency,
  getOffensiveStrategyFromRatings,
  getDefensiveStrategyFromRatings,
  getStrategyMatchupModifier,
  // Strategy rating boost functions
  getOffenseMatchupResult,
  getDefenseMatchupResult,
  getBoostMultiplier,
  getStrategyRatingMultipliers,
  getBoostedRating,
  avgBoostedRating,
};
