/**
 * QB Playstyle Classification & Team Chemistry
 * =============================================
 * Determines QB type and calculates offensive synergies.
 */

const { QB_PLAYSTYLES, tierToRating } = require('./constants');

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
  
  // Game manager: low volume but efficient
  if (attPerGame < 25 && passRatio > 0.85) {
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
// TEAM RATINGS CALCULATION
// =============================================================================

/**
 * Calculate average tier of a position group
 * @param {array} players - Array of player cards
 * @returns {number} - Average tier (1-10)
 */
function avgTier(players) {
  if (!players || players.length === 0) return 5; // Default to middle tier
  const sum = players.reduce((acc, p) => acc + (p.tier || 5), 0);
  return sum / players.length;
}

/**
 * Calculate offensive ratings considering QB playstyle synergies
 * @param {object} roster - Full team roster
 * @returns {object} - Offensive ratings
 */
function calculateOffensiveRatings(roster) {
  const qb = roster.QB;
  if (!qb) {
    return { passRating: 5, runRating: 5, style: 'BALANCED', config: QB_PLAYSTYLES.BALANCED };
  }
  
  const { style, config } = getPlaystyleConfig(qb);
  
  const qbTier = qb.tier || 5;
  const wrAvgTier = avgTier(roster.WRs || []);
  const rbAvgTier = avgTier(roster.RBs || []);
  const teAvgTier = roster.TE?.tier || 5;
  const olAvgTier = avgTier(roster.OLs || []) || 5;
  
  // Calculate pass game rating
  let passRating = (qbTier * config.qbDependency) + (wrAvgTier * config.wrDependency);
  
  // Apply synergy bonuses/penalties
  if (wrAvgTier >= 7) {
    passRating *= config.wrSynergyBonus;
  } else if (wrAvgTier <= 3) {
    passRating *= config.wrSynergyPenalty;
  }
  
  // TE adds small bonus
  passRating += (teAvgTier - 5) * 0.1;
  
  // OL affects time in pocket
  const protectionRating = olAvgTier;
  
  // Calculate run game rating
  let runRating = rbAvgTier * 0.5 + olAvgTier * 0.5;
  
  // Dual-threat QB contributes to run game
  if (config.rushContribution > 0) {
    runRating = runRating * (1 - config.rushContribution) + qbTier * config.rushContribution;
  }
  
  // TE blocking helps run game slightly
  runRating += (teAvgTier - 5) * 0.05;
  
  return {
    passRating: Math.max(1, Math.min(12, passRating)),  // Cap at 1-12
    runRating: Math.max(1, Math.min(12, runRating)),
    protectionRating,
    qbTier,
    wrAvgTier,
    rbAvgTier,
    teAvgTier,
    olAvgTier,
    style,
    config,
  };
}

/**
 * Calculate defensive ratings
 * @param {object} roster - Full team roster
 * @returns {object} - Defensive ratings
 */
function calculateDefensiveRatings(roster) {
  const dlAvgTier = avgTier(roster.DLs || []) || 5;
  const lbAvgTier = avgTier(roster.LBs || []) || 5;
  const dbAvgTier = avgTier(roster.DBs || []) || 5;
  
  // Pass defense: DBs most important, then pass rush
  const passDefenseRating = dbAvgTier * 0.50 + dlAvgTier * 0.30 + lbAvgTier * 0.20;
  
  // Run defense: DL and LB equally important
  const runDefenseRating = dlAvgTier * 0.40 + lbAvgTier * 0.40 + dbAvgTier * 0.20;
  
  // Pass rush rating (affects sacks and pressure)
  const passRushRating = dlAvgTier * 0.70 + lbAvgTier * 0.30;
  
  // Coverage rating
  const coverageRating = dbAvgTier * 0.70 + lbAvgTier * 0.30;
  
  return {
    passDefenseRating,
    runDefenseRating,
    passRushRating,
    coverageRating,
    dlAvgTier,
    lbAvgTier,
    dbAvgTier,
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
 * Calculate full team ratings
 * @param {object} roster - Full team roster
 * @returns {object} - All team ratings
 */
function calculateTeamRatings(roster) {
  const offense = calculateOffensiveRatings(roster);
  const defense = calculateDefensiveRatings(roster);
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
  };
}

// =============================================================================
// PLAY CALLING TENDENCIES
// =============================================================================

/**
 * Determine base pass/run tendency for a team
 * @param {object} offenseRatings - Calculated offense ratings
 * @param {object} defenseRatings - Opponent's defense ratings
 * @returns {number} - Pass frequency (0-1)
 */
function getPassTendency(offenseRatings, opponentDefense) {
  const { config, passRating, runRating } = offenseRatings;
  
  let passTendency = config.passFrequency;
  
  // Adjust based on strength differential
  const passAdvantage = passRating - opponentDefense.passDefenseRating;
  const runAdvantage = runRating - opponentDefense.runDefenseRating;
  
  // Lean towards the better matchup
  if (passAdvantage > runAdvantage + 1) {
    passTendency += 0.08;
  } else if (runAdvantage > passAdvantage + 1) {
    passTendency -= 0.08;
  }
  
  // Cap between 0.35 and 0.75
  return Math.max(0.35, Math.min(0.75, passTendency));
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
};
