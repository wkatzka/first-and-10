/**
 * Play Simulation
 * ================
 * Simulates complete pass, run, and special teams plays.
 */

const { PLAY_OUTCOMES, SITUATION, SCORING } = require('./constants');
const { avgTier, getPassTendency } = require('./playstyle');
const {
  roll,
  calculateProtection,
  calculateCoverage,
  calculateThrow,
  calculateCatch,
  calculateRunBlocking,
  calculateRush,
  calculateQBRun,
} = require('./matchups');

// =============================================================================
// PLAY TYPE SELECTION
// =============================================================================

/**
 * Select target WR for a pass play
 * @param {array} wrs - Array of WR cards
 * @param {array} dbs - Array of DB cards (coverage)
 * @param {string} passType - short, medium, deep
 * @returns {object} - { wr, db } - Selected matchup
 */
function selectTarget(wrs, dbs, passType) {
  if (!wrs || wrs.length === 0) {
    return { wr: { tier: 5 }, db: dbs?.[0] || { tier: 5 } };
  }
  
  // Weight by tier - better WRs get more targets
  const weights = wrs.map(wr => (wr.tier || 5) + roll() * 3);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  let selection = roll() * totalWeight;
  let selectedIdx = 0;
  
  for (let i = 0; i < weights.length; i++) {
    selection -= weights[i];
    if (selection <= 0) {
      selectedIdx = i;
      break;
    }
  }
  
  const wr = wrs[selectedIdx];
  
  // Match against a DB (random or by coverage)
  const db = dbs?.[Math.floor(roll() * (dbs?.length || 1))] || { tier: 5 };
  
  return { wr, db };
}

/**
 * Choose pass type based on situation
 */
function choosePassType(down, yardsToGo, fieldPosition) {
  // Deep shots are risky but rewarding
  const deepChance = 0.15;
  // Short passes are safe
  const shortChance = 0.35;
  
  // Adjust by situation
  let adjustedDeep = deepChance;
  let adjustedShort = shortChance;
  
  // 3rd and long = more deep attempts
  if (down === 3 && yardsToGo > 8) {
    adjustedDeep += 0.15;
    adjustedShort -= 0.10;
  }
  
  // 3rd and short = safe underneath
  if (down === 3 && yardsToGo <= 3) {
    adjustedShort += 0.20;
    adjustedDeep -= 0.10;
  }
  
  // Red zone = less deep (no room)
  if (fieldPosition > 80) {
    adjustedDeep -= 0.10;
  }
  
  // 1st down = balanced
  if (down === 1) {
    adjustedDeep += 0.05;
  }
  
  const typeRoll = roll();
  if (typeRoll < adjustedDeep) return 'deep';
  if (typeRoll < adjustedDeep + adjustedShort) return 'short';
  return 'medium';
}

// =============================================================================
// PASS PLAY SIMULATION
// =============================================================================

/**
 * Simulate a complete pass play
 * @param {object} offense - Offensive team ratings & roster
 * @param {object} defense - Defensive team ratings & roster
 * @param {object} situation - Game situation (down, distance, etc.)
 * @returns {object} - Play result
 */
function simulatePassPlay(offense, defense, situation) {
  const { down, yardsToGo, fieldPosition } = situation;
  
  const qb = offense.roster.QB;
  const wrs = offense.roster.WRs || [];
  const te = offense.roster.TE;
  const olTier = avgTier(offense.roster.OLs);
  
  const dls = defense.roster.DLs || [];
  const lbs = defense.roster.LBs || [];
  const dbs = defense.roster.DBs || [];
  const dlTier = avgTier(dls);
  
  // Step 1: Pass protection
  const protection = calculateProtection(olTier, dlTier);
  
  if (protection.sacked) {
    return {
      type: 'pass',
      result: 'sack',
      yards: protection.sackYards,
      description: `${qb?.player || 'QB'} sacked for ${protection.sackYards} yards`,
      turnover: false,
      timeElapsed: 25 + roll() * 10,
    };
  }
  
  // Step 2: Choose pass type and target
  const passType = choosePassType(down, yardsToGo, fieldPosition);
  
  // Include TE as potential target
  const allTargets = [...wrs];
  if (te) allTargets.push(te);
  
  const { wr, db } = selectTarget(allTargets, dbs, passType);
  
  // Step 3: WR vs DB coverage
  const coverage = calculateCoverage(wr, db);
  
  // Step 3.5: Check for scramble (dual-threat QBs)
  const playstyle = offense.ratings.offense.config;
  // Scramble chance scales with QB mobility trait (0-100).
  const qbMobTrait = qb?.engine_traits?.mobility;
  const mobTrait = typeof qbMobTrait === 'number' ? qbMobTrait : Number(qbMobTrait);
  const mobMult = Number.isFinite(mobTrait) ? Math.max(0.5, Math.min(1.6, 0.5 + mobTrait / 100)) : 1.0;
  const scrambleChance = Math.min(0.60, playstyle.scrambleChance * mobMult);

  if (protection.pressured && roll() < scrambleChance) {
    const scrambleResult = calculateQBRun(qb, avgTier([...dls, ...lbs]), false);
    return {
      type: 'pass',
      result: 'scramble',
      yards: scrambleResult.yards,
      description: `${qb?.player || 'QB'} scrambles for ${scrambleResult.yards} yards`,
      turnover: scrambleResult.fumbled,
      turnoverType: scrambleResult.fumbled ? 'fumble' : null,
      timeElapsed: 28 + roll() * 12,
    };
  }
  
  // Step 4: QB throw
  const throwResult = calculateThrow(qb, protection.pressured, coverage.separation, passType);
  
  // Step 5: Catch attempt
  const catchResult = calculateCatch(wr, db, qb, throwResult.accuracy, coverage.separation, passType);
  
  if (catchResult.caught) {
    return {
      type: 'pass',
      result: 'complete',
      yards: catchResult.yards,
      passType,
      target: wr?.player || 'WR',
      description: `${qb?.player || 'QB'} completes ${passType} pass to ${wr?.player || 'WR'} for ${catchResult.yards} yards`,
      turnover: false,
      timeElapsed: 25 + roll() * 15,
    };
  }
  
  if (catchResult.intercepted) {
    return {
      type: 'pass',
      result: 'interception',
      yards: 0,
      description: `${qb?.player || 'QB'} intercepted by ${db?.player || 'DB'}`,
      turnover: true,
      turnoverType: 'interception',
      timeElapsed: 25 + roll() * 10,
    };
  }
  
  return {
    type: 'pass',
    result: 'incomplete',
    yards: 0,
    passType,
    description: `${qb?.player || 'QB'} pass incomplete${catchResult.passDefended ? ' (defended)' : ''}`,
    turnover: false,
    timeElapsed: 22 + roll() * 8,
  };
}

// =============================================================================
// RUN PLAY SIMULATION
// =============================================================================

/**
 * Simulate a complete run play
 * @param {object} offense - Offensive team ratings & roster
 * @param {object} defense - Defensive team ratings & roster
 * @param {object} situation - Game situation
 * @returns {object} - Play result
 */
function simulateRunPlay(offense, defense, situation) {
  const rbs = offense.roster.RBs || [];
  const rb = rbs[Math.floor(roll() * rbs.length)] || { tier: 5, player: 'RB' };
  const olTier = avgTier(offense.roster.OLs);
  
  const dls = defense.roster.DLs || [];
  const lbs = defense.roster.LBs || [];
  const dlTier = avgTier(dls);
  const lbTier = avgTier(lbs);
  
  // Step 1: Run blocking
  const blocking = calculateRunBlocking(olTier, dlTier);
  
  if (blocking.stuffed) {
    return {
      type: 'run',
      result: 'tfl',
      yards: blocking.tflYards,
      carrier: rb?.player || 'RB',
      description: `${rb?.player || 'RB'} stuffed for ${blocking.tflYards} yards`,
      turnover: false,
      timeElapsed: 28 + roll() * 12,
    };
  }
  
  // Step 2: RB vs LB
  const rushResult = calculateRush(rb, lbTier, blocking.holeSize);
  
  if (rushResult.fumbled) {
    return {
      type: 'run',
      result: 'fumble',
      yards: Math.floor(rushResult.yards / 2),
      carrier: rb?.player || 'RB',
      description: `${rb?.player || 'RB'} fumbles after ${Math.floor(rushResult.yards / 2)} yards`,
      turnover: true,
      turnoverType: 'fumble',
      timeElapsed: 30 + roll() * 10,
    };
  }
  
  // Big run?
  const isBigRun = rushResult.yards >= 15;
  
  return {
    type: 'run',
    result: isBigRun ? 'big_gain' : 'gain',
    yards: rushResult.yards,
    carrier: rb?.player || 'RB',
    brokenTackle: rushResult.brokenTackle,
    description: `${rb?.player || 'RB'} rushes for ${rushResult.yards} yards${rushResult.brokenTackle ? ' (broken tackle)' : ''}`,
    turnover: false,
    timeElapsed: 32 + roll() * 10,
  };
}

// =============================================================================
// SPECIAL TEAMS
// =============================================================================

/**
 * Simulate a field goal attempt
 * @param {object} kicker - Kicker card
 * @param {number} distance - FG distance in yards
 * @returns {object} - Result
 */
function simulateFieldGoal(kicker, distance) {
  const kTier = kicker?.tier || 5;
  const outcomes = PLAY_OUTCOMES.SPECIAL_TEAMS;
  
  // Base accuracy by distance
  let baseAccuracy;
  if (distance <= 19) baseAccuracy = outcomes.FG_BASE_ACCURACY['0-19'];
  else if (distance <= 29) baseAccuracy = outcomes.FG_BASE_ACCURACY['20-29'];
  else if (distance <= 39) baseAccuracy = outcomes.FG_BASE_ACCURACY['30-39'];
  else if (distance <= 49) baseAccuracy = outcomes.FG_BASE_ACCURACY['40-49'];
  else baseAccuracy = outcomes.FG_BASE_ACCURACY['50+'];
  
  // Tier bonus
  const tierBonus = (kTier - 5) * outcomes.FG_TIER_BONUS;
  const accuracy = Math.min(0.99, baseAccuracy + tierBonus);
  
  const made = roll() < accuracy;
  
  return {
    type: 'field_goal',
    result: made ? 'good' : 'missed',
    distance,
    description: `${distance} yard field goal ${made ? 'is GOOD!' : 'NO GOOD'}`,
    points: made ? SCORING.FIELD_GOAL : 0,
    timeElapsed: 8,
  };
}

/**
 * Simulate an extra point attempt
 * @param {object} kicker - Kicker card
 * @returns {object} - Result
 */
function simulateExtraPoint(kicker) {
  const kTier = kicker?.tier || 5;
  const accuracy = SCORING.EXTRA_POINT_SUCCESS + (kTier - 5) * 0.01;
  
  const made = roll() < accuracy;
  
  return {
    type: 'extra_point',
    result: made ? 'good' : 'missed',
    description: `Extra point ${made ? 'is GOOD' : 'NO GOOD'}`,
    points: made ? SCORING.EXTRA_POINT : 0,
    timeElapsed: 5,
  };
}

/**
 * Simulate a punt
 * @param {object} punter - Punter card
 * @param {number} fieldPosition - Current field position
 * @returns {object} - Result with new field position
 */
function simulatePunt(punter, fieldPosition) {
  const pTier = punter?.tier || 5;
  const outcomes = PLAY_OUTCOMES.SPECIAL_TEAMS;
  
  const distance = outcomes.PUNT_DISTANCE_BASE + (pTier - 5) * outcomes.PUNT_DISTANCE_PER_TIER + (roll() - 0.5) * 15;
  
  // Calculate new field position (for receiving team)
  let landingSpot = fieldPosition + distance;
  
  // Touchback if in end zone
  if (landingSpot >= 100) {
    return {
      type: 'punt',
      result: 'touchback',
      distance: Math.round(distance),
      newFieldPosition: 25,
      description: `Punt for ${Math.round(distance)} yards, touchback`,
      timeElapsed: 45,
    };
  }
  
  // Fair catch or return (simplified)
  const returnYards = roll() < 0.6 ? 0 : Math.floor(5 + roll() * 15);
  const newPosition = 100 - landingSpot + returnYards;
  
  return {
    type: 'punt',
    result: 'return',
    distance: Math.round(distance),
    returnYards,
    newFieldPosition: Math.max(1, Math.min(99, Math.round(newPosition))),
    description: `Punt for ${Math.round(distance)} yards${returnYards > 0 ? `, returned ${returnYards} yards` : ', fair catch'}`,
    timeElapsed: 45,
  };
}

/**
 * Simulate a kickoff
 * @param {object} kicker - Kicker card
 * @returns {object} - Result with receiving team field position
 */
function simulateKickoff(kicker) {
  const kTier = kicker?.tier || 5;
  const outcomes = PLAY_OUTCOMES.SPECIAL_TEAMS;
  
  // Touchback chance based on kicker
  const touchbackChance = outcomes.TOUCHBACK_CHANCE + (kTier - 5) * 0.03;
  
  if (roll() < touchbackChance) {
    return {
      type: 'kickoff',
      result: 'touchback',
      newFieldPosition: 25,
      description: 'Kickoff, touchback',
      timeElapsed: 8,
    };
  }
  
  // Return
  const returnYards = outcomes.RETURN_YARDS_BASE + (roll() - 0.5) * 20;
  
  return {
    type: 'kickoff',
    result: 'return',
    returnYards: Math.round(returnYards),
    newFieldPosition: Math.min(50, Math.round(returnYards)),
    description: `Kickoff returned to the ${Math.round(returnYards)} yard line`,
    timeElapsed: 12,
  };
}

// =============================================================================
// MAIN PLAY SIMULATION
// =============================================================================

/**
 * Simulate a single play based on situation
 * @param {object} offense - Offensive team (ratings + roster)
 * @param {object} defense - Defensive team (ratings + roster)
 * @param {object} situation - Game situation
 * @returns {object} - Play result
 */
function simulatePlay(offense, defense, situation) {
  const { down, yardsToGo, fieldPosition, quarter, timeRemaining, scoreDiff } = situation;
  
  // Determine pass/run tendency
  let passTendency = getPassTendency(offense.ratings.offense, defense.ratings.defense);
  
  // Situational adjustments
  if (down === 3 && yardsToGo > 5) {
    passTendency += 0.20; // Pass more on 3rd and long
  }
  if (down === 3 && yardsToGo <= 2) {
    passTendency -= 0.10; // Can run on 3rd and short
  }
  if (fieldPosition > 90 && yardsToGo <= 3) {
    passTendency -= 0.15; // Goal line = more runs
  }
  if (quarter === 4 && timeRemaining < 120 && scoreDiff < 0) {
    passTendency += 0.25; // Two-minute drill, down
  }
  if (quarter === 4 && timeRemaining < 300 && scoreDiff > 0) {
    passTendency -= 0.20; // Protect lead, run more
  }
  
  // Decide play type
  const isPass = roll() < passTendency;
  
  if (isPass) {
    return simulatePassPlay(offense, defense, situation);
  } else {
    return simulateRunPlay(offense, defense, situation);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  simulatePlay,
  simulatePassPlay,
  simulateRunPlay,
  simulateFieldGoal,
  simulateExtraPoint,
  simulatePunt,
  simulateKickoff,
  selectTarget,
  choosePassType,
};
