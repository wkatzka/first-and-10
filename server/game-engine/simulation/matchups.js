/**
 * Position Matchup Calculations
 * ==============================
 * Core matchup logic for offense vs defense interactions.
 */

const { tierToRating, PLAY_OUTCOMES } = require('./constants');

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Roll a random number 0-1
 */
function roll() {
  return Math.random();
}

/**
 * Roll with a normal distribution (bell curve) around 0.5
 * More realistic than uniform distribution
 */
function rollNormal(mean = 0.5, stdDev = 0.15) {
  // Box-Muller transform for normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.min(1, mean + z * stdDev));
}

/**
 * Calculate matchup differential
 * Positive = offense advantage, Negative = defense advantage
 * @param {number} offenseTier - Offensive player tier (1-10)
 * @param {number} defenseTier - Defensive player tier (1-10)
 * @returns {number} - Differential (-9 to +9)
 */
function matchupDiff(offenseTier, defenseTier) {
  return (offenseTier || 5) - (defenseTier || 5);
}

/**
 * Convert matchup differential to win probability
 * @param {number} diff - Tier differential
 * @param {number} baseWinRate - Base win rate at neutral (default 0.5)
 * @returns {number} - Probability 0-1
 */
function diffToWinProb(diff, baseWinRate = 0.50) {
  // Each tier difference is worth ~5-7% win probability
  const adjustment = diff * 0.06;
  return Math.max(0.05, Math.min(0.95, baseWinRate + adjustment));
}

// =============================================================================
// PASS PLAY MATCHUPS
// =============================================================================

/**
 * Calculate pass protection outcome (OL vs DL)
 * @param {number} olTier - Average OL tier
 * @param {number} dlTier - Average DL pass rush tier
 * @returns {object} - { sacked, pressured, timeInPocket }
 */
function calculateProtection(olTier, dlTier) {
  const diff = matchupDiff(olTier, dlTier);
  const outcomes = PLAY_OUTCOMES.PASS;
  
  // Sack chance
  const sackChance = outcomes.SACK_BASE - (diff * outcomes.SACK_PER_DIFF);
  const sacked = roll() < Math.max(0.02, Math.min(0.25, sackChance));
  
  if (sacked) {
    const sackYards = -Math.floor(3 + roll() * 7); // -3 to -10 yards
    return { sacked: true, pressured: true, sackYards, timeInPocket: 1.5 };
  }
  
  // Pressure chance (affects accuracy)
  const pressureChance = outcomes.PRESSURE_BASE - (diff * outcomes.PRESSURE_PER_DIFF);
  const pressured = roll() < Math.max(0.10, Math.min(0.50, pressureChance));
  
  // Time in pocket (2-4 seconds)
  const timeInPocket = 2 + (diff * 0.2) + roll() * 1.5;
  
  return { sacked: false, pressured, timeInPocket: Math.max(1.5, Math.min(4.5, timeInPocket)) };
}

/**
 * Calculate WR vs DB matchup (route running / coverage)
 * @param {object} wr - WR player card
 * @param {object} db - DB player card
 * @returns {object} - { separation, contested, targetQuality }
 */
function calculateCoverage(wr, db) {
  const wrTier = wr?.tier || 5;
  const dbTier = db?.tier || 5;
  const diff = matchupDiff(wrTier, dbTier);
  
  // Separation level: open, contested, covered
  const separationRoll = roll() + (diff * 0.08);
  
  let separation;
  if (separationRoll > 0.65) {
    separation = 'open';
  } else if (separationRoll > 0.35) {
    separation = 'contested';
  } else {
    separation = 'covered';
  }
  
  // Target quality affects completion chance
  const targetQuality = 0.5 + (diff * 0.05);
  
  return { separation, targetQuality, wrTier, dbTier, diff };
}

/**
 * Calculate throw accuracy (QB + pressure + target)
 * @param {object} qb - QB player card
 * @param {boolean} pressured - Is QB under pressure
 * @param {string} separation - WR separation level
 * @param {string} passType - short, medium, deep
 * @returns {object} - { accuracy, throwQuality }
 */
function calculateThrow(qb, pressured, separation, passType = 'medium') {
  const qbTier = qb?.tier || 5;
  const qbRating = tierToRating(qbTier);
  const outcomes = PLAY_OUTCOMES.PASS;
  
  // Base accuracy from QB rating (60-95%)
  let accuracy = 0.55 + (qbRating * 0.40);
  
  // Pressure penalty
  if (pressured) {
    accuracy -= outcomes.PRESSURE_ACCURACY_PENALTY;
  }
  
  // Separation bonus/penalty
  if (separation === 'open') {
    accuracy += 0.15;
  } else if (separation === 'covered') {
    accuracy -= 0.15;
  }
  
  // Deep passes are harder
  if (passType === 'deep') {
    accuracy -= 0.12;
  } else if (passType === 'short') {
    accuracy += 0.08;
  }
  
  // Add some variance
  accuracy += (roll() - 0.5) * 0.10;
  
  return {
    accuracy: Math.max(0.15, Math.min(0.95, accuracy)),
    throwQuality: accuracy > 0.7 ? 'good' : accuracy > 0.5 ? 'decent' : 'poor',
  };
}

/**
 * Calculate catch attempt outcome
 * @param {object} wr - WR player card
 * @param {object} db - DB player card  
 * @param {number} throwAccuracy - QB throw accuracy
 * @param {string} separation - Coverage separation
 * @returns {object} - { caught, intercepted, passDefended, yards }
 */
function calculateCatch(wr, db, throwAccuracy, separation, passType = 'medium') {
  const wrTier = wr?.tier || 5;
  const dbTier = db?.tier || 5;
  const outcomes = PLAY_OUTCOMES.PASS;
  
  // WR catch ability (based on tier)
  const catchAbility = 0.70 + (tierToRating(wrTier) * 0.25);
  
  // DB ball skills (INT/PD chance)
  const dbBallSkills = 0.05 + (tierToRating(dbTier) * 0.10);
  
  // Combined completion chance
  let completionChance = throwAccuracy * catchAbility;
  
  // Separation modifier
  if (separation === 'open') {
    completionChance *= 1.15;
  } else if (separation === 'covered') {
    completionChance *= 0.70;
  }
  
  // Roll for outcome
  const catchRoll = roll();
  
  if (catchRoll < completionChance) {
    // Catch! Calculate yards
    let baseYards;
    if (passType === 'short') {
      baseYards = outcomes.SHORT_YARDS.min + roll() * (outcomes.SHORT_YARDS.max - outcomes.SHORT_YARDS.min);
    } else if (passType === 'deep') {
      baseYards = outcomes.DEEP_YARDS.min + roll() * (outcomes.DEEP_YARDS.max - outcomes.DEEP_YARDS.min);
    } else {
      baseYards = outcomes.MEDIUM_YARDS.min + roll() * (outcomes.MEDIUM_YARDS.max - outcomes.MEDIUM_YARDS.min);
    }
    
    // YAC based on WR tier and separation
    let yac = outcomes.YAC_BASE + (wrTier - 5) * outcomes.YAC_PER_TIER;
    if (separation === 'open') yac *= 1.5;
    if (separation === 'covered') yac *= 0.3;
    yac *= roll();
    
    const totalYards = Math.round(baseYards + yac);
    
    return { caught: true, intercepted: false, passDefended: false, yards: totalYards };
  }
  
  // Not caught - check for interception
  const intChance = outcomes.INT_BASE + (dbTier - wrTier) * outcomes.INT_COVERAGE_BONUS;
  if (roll() < Math.max(0.01, Math.min(0.15, intChance))) {
    return { caught: false, intercepted: true, passDefended: false, yards: 0 };
  }
  
  // Pass defended or just incomplete
  const pdChance = dbBallSkills;
  return { 
    caught: false, 
    intercepted: false, 
    passDefended: roll() < pdChance,
    yards: 0,
  };
}

// =============================================================================
// RUN PLAY MATCHUPS
// =============================================================================

/**
 * Calculate run blocking outcome (OL vs DL)
 * @param {number} olTier - Average OL tier
 * @param {number} dlTier - Average DL tier
 * @returns {object} - { holeSize, stuffed }
 */
function calculateRunBlocking(olTier, dlTier) {
  const diff = matchupDiff(olTier, dlTier);
  const outcomes = PLAY_OUTCOMES.RUN;
  
  // TFL chance
  const tflChance = outcomes.TFL_BASE - (diff * outcomes.TFL_PER_DIFF);
  if (roll() < Math.max(0.03, Math.min(0.20, tflChance))) {
    const tflYards = -Math.floor(1 + roll() * 4); // -1 to -5 yards
    return { holeSize: 'none', stuffed: true, tflYards };
  }
  
  // Hole size
  const holeRoll = roll() + (diff * 0.10);
  let holeSize;
  if (holeRoll > 0.70) {
    holeSize = 'big';
  } else if (holeRoll > 0.35) {
    holeSize = 'small';
  } else {
    holeSize = 'tight';
  }
  
  return { holeSize, stuffed: false };
}

/**
 * Calculate RB vs LB matchup (first contact)
 * @param {object} rb - RB player card
 * @param {number} lbTier - Average LB tier
 * @param {string} holeSize - From blocking calculation
 * @returns {object} - { yardsGained, brokenTackle }
 */
function calculateRush(rb, lbTier, holeSize) {
  const rbTier = rb?.tier || 5;
  const diff = matchupDiff(rbTier, lbTier);
  const outcomes = PLAY_OUTCOMES.RUN;
  
  // Base yards
  let yards = outcomes.YARDS_BASE + (diff * outcomes.YARDS_PER_TIER);
  
  // Hole size modifier
  if (holeSize === 'big') {
    yards += 3 + roll() * 4;
  } else if (holeSize === 'tight') {
    yards -= 1 + roll() * 2;
  }
  
  // Broken tackle chance
  const brokenTackleChance = 0.10 + (rbTier - 5) * 0.03;
  const brokenTackle = roll() < brokenTackleChance;
  
  if (brokenTackle) {
    yards += 3 + roll() * 6;
  }
  
  // Breakaway chance (big run)
  if (roll() < outcomes.BREAKAWAY_CHANCE + (rbTier - 5) * 0.01) {
    yards = outcomes.BREAKAWAY_YARDS.min + roll() * (outcomes.BREAKAWAY_YARDS.max - outcomes.BREAKAWAY_YARDS.min);
  }
  
  // Fumble chance
  const fumbleChance = outcomes.FUMBLE_BASE;
  const fumbled = roll() < fumbleChance;
  
  return {
    yards: Math.round(Math.max(-5, yards)),
    brokenTackle,
    fumbled,
  };
}

/**
 * Calculate QB scramble/designed run
 * @param {object} qb - QB player card
 * @param {number} defTier - Average defense tier
 * @param {boolean} designed - Is this a designed run vs scramble
 * @returns {object} - { yards, fumbled }
 */
function calculateQBRun(qb, defTier, designed = false) {
  const qbTier = qb?.tier || 5;
  const diff = matchupDiff(qbTier, defTier);
  
  // QBs generally get less yards than RBs
  let yards = 3 + (diff * 0.5) + roll() * 5;
  
  // Designed runs are more effective
  if (designed) {
    yards += 2;
  }
  
  // Scrambles have higher variance
  if (!designed) {
    yards += (roll() - 0.5) * 8;
  }
  
  // QBs protect the ball better (lower fumble rate)
  const fumbled = roll() < 0.01;
  
  return {
    yards: Math.round(Math.max(-3, yards)),
    fumbled,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  roll,
  rollNormal,
  matchupDiff,
  diffToWinProb,
  calculateProtection,
  calculateCoverage,
  calculateThrow,
  calculateCatch,
  calculateRunBlocking,
  calculateRush,
  calculateQBRun,
};
