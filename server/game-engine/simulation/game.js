/**
 * Game Simulation Engine
 * =======================
 * Main game loop with clock, scoring, and drive management.
 */

const { GAME, SCORING, DRIVE, STRATEGY_BOOST_AMOUNT } = require('./constants');
const {
  calculateTeamRatings,
  getOffensiveStrategyFromRatings,
  getDefensiveStrategyFromRatings,
  getStrategyRatingMultipliers,
} = require('./playstyle');
const {
  simulatePlay,
  simulateFieldGoal,
  simulateExtraPoint,
  simulatePunt,
  simulateKickoff,
} = require('./plays');
const { roll } = require('./matchups');

// =============================================================================
// GAME STATE
// =============================================================================

/**
 * Apply rating multipliers directly to roster player tiers
 * This ensures the boosted tiers are used in play simulation
 * Updated for 11-slot roster: single RB, OL, DL, LB (WRs, DBs still arrays)
 */
function applyRosterBoosts(roster, multipliers) {
  const boostTier = (player, posKey) => {
    if (!player) return player;
    const mult = multipliers[posKey] || 1.0;
    if (mult === 1.0) return player;
    // Apply multiplier to effective tier (allows > 11 or < 1 internally)
    const boostedTier = player.tier * mult;
    return { ...player, tier: boostedTier, tierBase: player.tier };
  };
  
  const boostArray = (players, posKey) => {
    if (!players) return players;
    return players.map(p => boostTier(p, posKey));
  };
  
  return {
    ...roster,
    QB: boostTier(roster.QB, 'QB'),
    // Handle both old (RBs array) and new (single RB) formats
    RB: roster.RB ? boostTier(roster.RB, 'RB') : undefined,
    RBs: roster.RBs ? boostArray(roster.RBs, 'RB') : undefined,
    WRs: boostArray(roster.WRs, 'WR'),
    TE: boostTier(roster.TE, 'TE'),
    // Handle both old (OLs array) and new (single OL) formats
    OL: roster.OL ? boostTier(roster.OL, 'OL') : undefined,
    OLs: roster.OLs ? boostArray(roster.OLs, 'OL') : undefined,
    // Handle both old (DLs array) and new (single DL) formats
    DL: roster.DL ? boostTier(roster.DL, 'DL') : undefined,
    DLs: roster.DLs ? boostArray(roster.DLs, 'DL') : undefined,
    // Handle both old (LBs array) and new (single LB) formats
    LB: roster.LB ? boostTier(roster.LB, 'LB') : undefined,
    LBs: roster.LBs ? boostArray(roster.LBs, 'LB') : undefined,
    DBs: boostArray(roster.DBs, 'DB'),
    K: boostTier(roster.K, 'K'),
  };
}

/**
 * Create initial game state with strategy-based rating boosts
 * @param {object} homeRoster - Home team roster
 * @param {object} awayRoster - Away team roster
 * @param {object} options - Options: { homeForceBalanced, awayForceBalanced }
 */
function createGameState(homeRoster, awayRoster, options = {}) {
  const { homeForceBalanced = false, awayForceBalanced = false } = options;
  
  // Step 1: Calculate BASE ratings (no boosts) to derive strategies
  const homeBaseRatings = calculateTeamRatings(homeRoster);
  const awayBaseRatings = calculateTeamRatings(awayRoster);
  
  // Derive strategies from roster composition (or force balanced if over tier cap)
  const homeOffStrategy = homeForceBalanced ? 'balanced' : getOffensiveStrategyFromRatings(homeBaseRatings.offense);
  const homeDefStrategy = homeForceBalanced ? 'base_defense' : getDefensiveStrategyFromRatings(homeBaseRatings.defense);
  const awayOffStrategy = awayForceBalanced ? 'balanced' : getOffensiveStrategyFromRatings(awayBaseRatings.offense);
  const awayDefStrategy = awayForceBalanced ? 'base_defense' : getDefensiveStrategyFromRatings(awayBaseRatings.defense);
  
  // Step 2: Get rating multipliers based on strategy matchup
  const homeMultipliers = getStrategyRatingMultipliers(
    homeOffStrategy, homeDefStrategy, awayOffStrategy, awayDefStrategy
  );
  const awayMultipliers = getStrategyRatingMultipliers(
    awayOffStrategy, awayDefStrategy, homeOffStrategy, homeDefStrategy
  );
  
  // Step 3: Apply boosts directly to roster player tiers
  const homeBoostedRoster = applyRosterBoosts(homeRoster, homeMultipliers);
  const awayBoostedRoster = applyRosterBoosts(awayRoster, awayMultipliers);
  
  // Step 4: Calculate ratings with boosted rosters (for display and play-calling)
  const homeStrategyContext = {
    myOffense: homeOffStrategy,
    myDefense: homeDefStrategy,
    theirOffense: awayOffStrategy,
    theirDefense: awayDefStrategy,
  };
  const awayStrategyContext = {
    myOffense: awayOffStrategy,
    myDefense: awayDefStrategy,
    theirOffense: homeOffStrategy,
    theirDefense: homeDefStrategy,
  };
  
  const homeBoostedRatings = calculateTeamRatings(homeBoostedRoster, homeStrategyContext);
  const awayBoostedRatings = calculateTeamRatings(awayBoostedRoster, awayStrategyContext);
  
  return {
    // Scores
    homeScore: 0,
    awayScore: 0,
    
    // Clock
    quarter: 1,
    timeRemaining: GAME.QUARTER_LENGTH, // Seconds remaining in quarter
    
    // Possession
    possession: roll() < 0.5 ? 'home' : 'away', // Coin flip
    receivingSecondHalf: null, // Set after coin flip
    
    // Field position
    fieldPosition: GAME.STARTING_FIELD_POSITION, // Offensive team's yard line
    down: 1,
    yardsToGo: GAME.YARDS_FOR_FIRST_DOWN,
    
    // Game tracking
    plays: [],
    drives: [],
    currentDrive: null,
    
    // Team data (boosted rosters, ratings + strategies)
    home: {
      roster: homeBoostedRoster,  // Use boosted roster for play simulation
      ratings: homeBoostedRatings,
      offensiveStrategy: homeOffStrategy,
      defensiveStrategy: homeDefStrategy,
      stats: createTeamStats(),
    },
    away: {
      roster: awayBoostedRoster,  // Use boosted roster for play simulation
      ratings: awayBoostedRatings,
      offensiveStrategy: awayOffStrategy,
      defensiveStrategy: awayDefStrategy,
      stats: createTeamStats(),
    },
    
    // Game status
    gameOver: false,
    winner: null,
  };
}

/**
 * Create empty team stats
 */
function createTeamStats() {
  return {
    passingYards: 0,
    rushingYards: 0,
    totalYards: 0,
    passingTDs: 0,
    rushingTDs: 0,
    interceptions: 0,
    fumbles: 0,
    sacks: 0,
    fieldGoals: 0,
    punts: 0,
    timeOfPossession: 0,
    plays: 0,
    firstDowns: 0,
  };
}

/**
 * Start a new drive
 */
function startDrive(state, startPosition, reason) {
  const drive = {
    team: state.possession,
    startPosition,
    startTime: state.timeRemaining,
    startQuarter: state.quarter,
    plays: [],
    result: null, // TD, FG, punt, turnover, end of half, etc.
    yards: 0,
    timeElapsed: 0,
  };
  
  state.currentDrive = drive;
  state.fieldPosition = startPosition;
  state.down = 1;
  state.yardsToGo = GAME.YARDS_FOR_FIRST_DOWN;
  
  return drive;
}

/**
 * End current drive
 */
function endDrive(state, result) {
  if (state.currentDrive) {
    state.currentDrive.result = result;
    state.currentDrive.endTime = state.timeRemaining;
    state.currentDrive.endQuarter = state.quarter;
    state.drives.push(state.currentDrive);
    state.currentDrive = null;
  }
}

// =============================================================================
// CLOCK MANAGEMENT
// =============================================================================

/**
 * Advance game clock
 */
function advanceClock(state, seconds) {
  state.timeRemaining -= seconds;
  
  // Track time of possession
  const team = state.possession === 'home' ? state.home : state.away;
  team.stats.timeOfPossession += seconds;
  
  // Check for end of quarter
  if (state.timeRemaining <= 0) {
    handleEndOfQuarter(state);
  }
}

/**
 * Handle end of quarter
 */
function handleEndOfQuarter(state) {
  state.quarter++;
  state.timeRemaining = GAME.QUARTER_LENGTH;
  
  if (state.quarter === 3) {
    // Halftime - receiving team gets ball
    handleHalftime(state);
  } else if (state.quarter > 4) {
    // End of regulation
    handleEndOfGame(state);
  }
}

/**
 * Handle halftime
 */
function handleHalftime(state) {
  endDrive(state, 'end_of_half');
  
  // Switch possession to whoever deferred
  state.possession = state.receivingSecondHalf || (state.possession === 'home' ? 'away' : 'home');
  
  // Kickoff to start second half
  const kickoff = simulateKickoff(state[state.possession === 'home' ? 'away' : 'home'].roster.K);
  startDrive(state, kickoff.newFieldPosition, 'kickoff');
  
  state.plays.push({
    ...kickoff,
    quarter: state.quarter,
    time: formatTime(state.timeRemaining),
    possession: state.possession,
  });
}

/**
 * Handle end of game - check for overtime if tied
 */
function handleEndOfGame(state) {
  endDrive(state, 'end_of_regulation');
  
  if (state.homeScore === state.awayScore && !state.overtime) {
    // Tied at end of regulation - go to overtime
    runOvertime(state);
    return;
  }
  
  state.gameOver = true;
  
  if (state.homeScore > state.awayScore) {
    state.winner = 'home';
  } else if (state.awayScore > state.homeScore) {
    state.winner = 'away';
  } else {
    // Should not happen with overtime, but fallback
    state.winner = 'tie';
  }
}

/**
 * NFL Overtime Rules:
 * 1. Both teams get at least one possession (guaranteed)
 * 2. After both teams have had one possession, sudden death applies
 * 3. Next score wins after both teams have possessed
 */
function runOvertime(state) {
  state.overtime = true;
  state.quarter = 5; // OT is "5th quarter"
  state.timeRemaining = GAME.QUARTER_LENGTH; // 10 min OT period
  
  // Track OT possessions
  state.otPossessions = { home: 0, away: 0 };
  state.otSuddenDeath = false;
  
  // Coin toss - random team receives
  const otReceiver = Math.random() < 0.5 ? 'home' : 'away';
  state.possession = otReceiver;
  
  state.plays.push({
    type: 'overtime_start',
    description: `Overtime begins. ${otReceiver === 'home' ? 'Home' : 'Away'} team receives.`,
    quarter: 5,
    time: formatTime(state.timeRemaining),
  });
  
  // OT kickoff
  const kicker = state[otReceiver === 'home' ? 'away' : 'home'].roster.K;
  const kickoff = simulateKickoff(kicker);
  state.plays.push({
    ...kickoff,
    quarter: 5,
    time: formatTime(state.timeRemaining),
    possession: state.possession,
  });
  
  startDrive(state, kickoff.newFieldPosition, 'overtime_kickoff');
  state.otPossessions[otReceiver]++;
  
  // Run OT plays
  let playCount = 0;
  const maxOTPlays = 100;
  
  while (!state.gameOver && playCount < maxOTPlays) {
    const prevPossession = state.possession;
    const prevHomeScore = state.homeScore;
    const prevAwayScore = state.awayScore;
    
    runPlay(state);
    playCount++;
    
    // Check if possession changed (drive ended without scoring)
    if (state.possession !== prevPossession && !state.gameOver) {
      state.otPossessions[state.possession]++;
      
      // Check if both teams have now had a possession
      if (state.otPossessions.home >= 1 && state.otPossessions.away >= 1) {
        state.otSuddenDeath = true;
      }
    }
    
    // Check for score
    const homeScored = state.homeScore > prevHomeScore;
    const awayScored = state.awayScore > prevAwayScore;
    
    if (homeScored || awayScored) {
      const scoringTeam = homeScored ? 'home' : 'away';
      const otherTeam = scoringTeam === 'home' ? 'away' : 'home';
      
      // In sudden death, any score wins
      if (state.otSuddenDeath) {
        state.gameOver = true;
        state.winner = scoringTeam;
        state.plays.push({
          type: 'overtime_end',
          description: `${scoringTeam === 'home' ? 'Home' : 'Away'} team wins in sudden death overtime!`,
          quarter: 5,
          time: formatTime(state.timeRemaining),
        });
        return;
      }
      
      // Not sudden death yet - check if other team has had possession
      if (state.otPossessions[otherTeam] >= 1) {
        // Other team had a chance, this score wins
        state.gameOver = true;
        state.winner = scoringTeam;
        state.plays.push({
          type: 'overtime_end',
          description: `${scoringTeam === 'home' ? 'Home' : 'Away'} team wins in overtime!`,
          quarter: 5,
          time: formatTime(state.timeRemaining),
        });
        return;
      }
      
      // Other team hasn't had possession yet - they get their guaranteed chance
      // Give them a kickoff
      state.possession = scoringTeam; // Scoring team kicks
      const kicker = state[scoringTeam].roster.K;
      const kickoff = simulateKickoff(kicker);
      
      state.possession = otherTeam; // Other team receives
      state.otPossessions[otherTeam]++;
      
      state.plays.push({
        ...kickoff,
        quarter: 5,
        time: formatTime(state.timeRemaining),
        possession: state.possession,
        description: `Kickoff to ${otherTeam === 'home' ? 'Home' : 'Away'} team for their guaranteed possession.`,
      });
      
      startDrive(state, kickoff.newFieldPosition, 'overtime_kickoff');
      
      // After this possession ends, it will be sudden death
      // (both teams will have had at least one possession)
    }
    
    // Time check - if OT period ends
    if (state.timeRemaining <= 0) {
      // If still tied after OT period and both had possession, end as tie (rare in NFL)
      // But in our game, let's keep playing sudden death until someone scores
      if (state.homeScore === state.awayScore) {
        state.otSuddenDeath = true;
        state.timeRemaining = GAME.QUARTER_LENGTH; // Reset clock for continued sudden death
      }
    }
  }
  
  // If we somehow exit without a winner, determine by score
  state.gameOver = true;
  if (state.homeScore > state.awayScore) {
    state.winner = 'home';
  } else if (state.awayScore > state.homeScore) {
    state.winner = 'away';
  } else {
    // Extremely rare - true tie after max plays
    state.winner = Math.random() < 0.5 ? 'home' : 'away'; // Coin flip to avoid ties
  }
}

/**
 * Format time for display
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// SCORING
// =============================================================================

/**
 * Handle touchdown
 */
function handleTouchdown(state) {
  const team = state.possession === 'home' ? 'home' : 'away';
  
  // Add TD points
  state[team + 'Score'] += SCORING.TOUCHDOWN;
  state[team].stats[state.plays[state.plays.length - 1]?.type === 'pass' ? 'passingTDs' : 'rushingTDs']++;
  
  // Extra point attempt
  const kicker = state[team].roster.K;
  const xp = simulateExtraPoint(kicker);
  state[team + 'Score'] += xp.points;
  
  state.plays.push({
    ...xp,
    quarter: state.quarter,
    time: formatTime(state.timeRemaining),
    possession: state.possession,
  });
  
  endDrive(state, 'touchdown');
  
  // In overtime, don't kickoff - let the OT loop handle game end
  if (state.overtime) {
    return;
  }
  
  // Kickoff
  handleKickoff(state);
}

/**
 * Handle field goal attempt
 */
function handleFieldGoalAttempt(state) {
  const team = state.possession === 'home' ? 'home' : 'away';
  const distance = 100 - state.fieldPosition + 17; // Add 17 for end zone + hold
  
  const kicker = state[team].roster.K;
  const result = simulateFieldGoal(kicker, distance);
  
  state.plays.push({
    ...result,
    quarter: state.quarter,
    time: formatTime(state.timeRemaining),
    possession: state.possession,
  });
  
  advanceClock(state, result.timeElapsed);
  
  if (result.result === 'good') {
    state[team + 'Score'] += SCORING.FIELD_GOAL;
    state[team].stats.fieldGoals++;
    endDrive(state, 'field_goal');
    
    // In overtime, don't kickoff - let the OT loop handle game end
    if (!state.overtime) {
      handleKickoff(state);
    }
  } else {
    // Missed FG - other team gets ball at spot of kick (or 20)
    endDrive(state, 'missed_fg');
    switchPossession(state, Math.max(20, state.fieldPosition));
  }
}

/**
 * Handle punt
 */
function handlePunt(state) {
  const team = state.possession === 'home' ? 'home' : 'away';
  const punter = state[team].roster.P;
  
  const result = simulatePunt(punter, state.fieldPosition);
  
  state.plays.push({
    ...result,
    quarter: state.quarter,
    time: formatTime(state.timeRemaining),
    possession: state.possession,
  });
  
  advanceClock(state, result.timeElapsed);
  state[team].stats.punts++;
  
  endDrive(state, 'punt');
  switchPossession(state, result.newFieldPosition);
}

/**
 * Handle kickoff
 */
function handleKickoff(state) {
  // Kicking team is opposite of possession (they just scored)
  const kickingTeam = state.possession;
  state.possession = state.possession === 'home' ? 'away' : 'home';
  
  const kicker = state[kickingTeam].roster.K;
  const result = simulateKickoff(kicker);
  
  state.plays.push({
    ...result,
    quarter: state.quarter,
    time: formatTime(state.timeRemaining),
    possession: state.possession,
  });
  
  advanceClock(state, result.timeElapsed);
  startDrive(state, result.newFieldPosition, 'kickoff');
}

/**
 * Switch possession (after turnover or punt)
 */
function switchPossession(state, newFieldPosition) {
  state.possession = state.possession === 'home' ? 'away' : 'home';
  startDrive(state, newFieldPosition, 'turnover');
}

// =============================================================================
// GAME DECISIONS
// =============================================================================

/**
 * Decide what to do on 4th down
 */
function decide4thDown(state) {
  const fieldPosition = state.fieldPosition;
  const yardsToGo = state.yardsToGo;
  const scoreDiff = state.possession === 'home' 
    ? state.homeScore - state.awayScore 
    : state.awayScore - state.homeScore;
  const timeRemaining = state.timeRemaining + (4 - state.quarter) * GAME.QUARTER_LENGTH;
  
  // In FG range (inside ~45 yard line = 62 yard FG attempt)
  const inFGRange = fieldPosition >= 55;
  const fgDistance = 100 - fieldPosition + 17;
  
  // Desperation mode - must score
  if (state.quarter === 4 && timeRemaining < 120 && scoreDiff < 0) {
    if (fieldPosition > 60 || yardsToGo <= 3) {
      return 'go_for_it';
    }
  }
  
  // Short yardage - often go for it
  if (yardsToGo <= DRIVE.SHORT_YARDAGE) {
    // Own territory - usually punt unless desperate
    if (fieldPosition < 40) {
      return roll() < 0.15 ? 'go_for_it' : 'punt';
    }
    // Midfield - more aggressive
    if (fieldPosition < 60) {
      return roll() < 0.40 ? 'go_for_it' : (inFGRange ? 'field_goal' : 'punt');
    }
    // Red zone - almost always go for it or kick
    if (fieldPosition >= 60) {
      return roll() < 0.50 ? 'go_for_it' : 'field_goal';
    }
  }
  
  // Longer yardage
  if (inFGRange && fgDistance <= 55) {
    return 'field_goal';
  }
  
  return 'punt';
}

// =============================================================================
// MAIN GAME LOOP
// =============================================================================

/**
 * Simulate a single play and update game state
 */
function runPlay(state) {
  if (state.gameOver) return;
  
  const offenseKey = state.possession;
  const defenseKey = state.possession === 'home' ? 'away' : 'home';
  
  const offense = state[offenseKey];
  const defense = state[defenseKey];
  
  const situation = {
    down: state.down,
    yardsToGo: state.yardsToGo,
    fieldPosition: state.fieldPosition,
    quarter: state.quarter,
    timeRemaining: state.timeRemaining,
    scoreDiff: offenseKey === 'home' 
      ? state.homeScore - state.awayScore 
      : state.awayScore - state.homeScore,
  };
  
  // Simulate the play
  const playResult = simulatePlay(offense, defense, situation);
  
  // Record the play
  const play = {
    ...playResult,
    quarter: state.quarter,
    time: formatTime(state.timeRemaining),
    possession: state.possession,
    down: state.down,
    yardsToGo: state.yardsToGo,
    fieldPosition: state.fieldPosition,
    playNumber: state.plays.length + 1,
  };
  
  state.plays.push(play);
  if (state.currentDrive) {
    state.currentDrive.plays.push(play);
  }
  
  // Update stats
  offense.stats.plays++;
  if (playResult.type === 'pass') {
    if (playResult.result === 'complete') {
      offense.stats.passingYards += playResult.yards;
    } else if (playResult.result === 'sack') {
      offense.stats.sacks++;
    }
    if (playResult.result === 'interception') {
      offense.stats.interceptions++;
    }
  } else if (playResult.type === 'run') {
    offense.stats.rushingYards += playResult.yards;
    if (playResult.result === 'fumble') {
      offense.stats.fumbles++;
    }
  }
  offense.stats.totalYards = offense.stats.passingYards + offense.stats.rushingYards;
  
  // Advance clock
  advanceClock(state, playResult.timeElapsed);
  
  // Handle turnovers
  if (playResult.turnover) {
    endDrive(state, playResult.turnoverType);
    const turnoverPosition = 100 - state.fieldPosition - (playResult.yards || 0);
    switchPossession(state, Math.max(20, Math.min(80, turnoverPosition)));
    return;
  }
  
  // Update field position
  state.fieldPosition += playResult.yards;
  
  // Touchdown check
  if (state.fieldPosition >= 100) {
    handleTouchdown(state);
    return;
  }
  
  // Safety check (tackled in own end zone)
  if (state.fieldPosition <= 0) {
    // Safety - 2 points to defense, kick from 20
    const defenseTeam = defenseKey;
    state[defenseTeam + 'Score'] += SCORING.SAFETY;
    endDrive(state, 'safety');
    
    // In overtime, don't kickoff - let the OT loop handle
    if (state.overtime) {
      return;
    }
    
    // Free kick from 20
    state.possession = offenseKey; // Same team kicks
    state.fieldPosition = 20;
    handleKickoff(state);
    return;
  }
  
  // First down check
  if (playResult.yards >= state.yardsToGo) {
    state.down = 1;
    state.yardsToGo = Math.min(GAME.YARDS_FOR_FIRST_DOWN, 100 - state.fieldPosition);
    offense.stats.firstDowns++;
    return;
  }
  
  // Advance down
  state.down++;
  state.yardsToGo -= playResult.yards;
  
  // 4th down decision
  if (state.down > 4) {
    const decision = decide4thDown(state);
    
    if (decision === 'go_for_it') {
      // Reset to 4th down and run another play
      state.down = 4;
      // Play will be run on next iteration
    } else if (decision === 'field_goal') {
      handleFieldGoalAttempt(state);
    } else {
      handlePunt(state);
    }
  }
}

/**
 * Simulate a complete game
 */
function simulateGame(homeRoster, awayRoster, options = {}) {
  const { verbose = false, maxPlays = 300, homeForceBalanced = false, awayForceBalanced = false } = options;
  
  // Initialize game state (pass forceBalanced flags for over-cap penalty)
  const state = createGameState(homeRoster, awayRoster, { homeForceBalanced, awayForceBalanced });
  
  // Set who receives second half
  state.receivingSecondHalf = state.possession === 'home' ? 'away' : 'home';
  
  // Opening kickoff
  const openingKickoff = simulateKickoff(state[state.possession === 'home' ? 'away' : 'home'].roster.K);
  state.plays.push({
    ...openingKickoff,
    quarter: 1,
    time: formatTime(state.timeRemaining),
    possession: state.possession,
  });
  
  startDrive(state, openingKickoff.newFieldPosition, 'kickoff');
  
  // Main game loop
  let playCount = 0;
  while (!state.gameOver && playCount < maxPlays) {
    runPlay(state);
    playCount++;
    
    if (verbose && playCount % 20 === 0) {
      console.log(`Q${state.quarter} ${formatTime(state.timeRemaining)} - Home: ${state.homeScore}, Away: ${state.awayScore}`);
    }
  }
  
  // Ensure game ends
  if (!state.gameOver) {
    handleEndOfGame(state);
  }
  
  return {
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    winner: state.winner,
    overtime: state.overtime || false,
    plays: state.plays,
    drives: state.drives,
    homeStats: state.home.stats,
    awayStats: state.away.stats,
    homeRatings: state.home.ratings,
    awayRatings: state.away.ratings,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  simulateGame,
  createGameState,
  runPlay,
  formatTime,
};
