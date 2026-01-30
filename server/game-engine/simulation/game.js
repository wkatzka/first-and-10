/**
 * Game Simulation Engine
 * =======================
 * Main game loop with clock, scoring, and drive management.
 */

const { GAME, SCORING, DRIVE } = require('./constants');
const { calculateTeamRatings } = require('./playstyle');
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
 * Create initial game state
 */
function createGameState(homeRoster, awayRoster) {
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
    
    // Team data
    home: {
      roster: homeRoster,
      ratings: calculateTeamRatings(homeRoster),
      stats: createTeamStats(),
    },
    away: {
      roster: awayRoster,
      ratings: calculateTeamRatings(awayRoster),
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
 * Handle end of game
 */
function handleEndOfGame(state) {
  state.gameOver = true;
  endDrive(state, 'end_of_game');
  
  if (state.homeScore > state.awayScore) {
    state.winner = 'home';
  } else if (state.awayScore > state.homeScore) {
    state.winner = 'away';
  } else {
    state.winner = 'tie';
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
    handleKickoff(state);
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
  const { verbose = false, maxPlays = 300 } = options;
  
  // Initialize game state
  const state = createGameState(homeRoster, awayRoster);
  
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
