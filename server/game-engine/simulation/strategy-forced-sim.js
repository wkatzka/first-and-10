/**
 * Forced Strategy Simulation
 * ===========================
 * Uses IDENTICAL rosters but forces different strategies to isolate the effect.
 * 
 * Usage: node strategy-forced-sim.js
 */

const { simulateGame: simulateGameCore } = require('./game');
const { calculateTeamRatings } = require('./playstyle');

// =============================================================================
// IDENTICAL ROSTERS (T7 everything - truly neutral)
// =============================================================================

const NEUTRAL_ROSTER = {
  QB: { player: 'Neutral QB', tier: 7, pos_group: 'QB' },
  RB: { player: 'Neutral RB', tier: 7, pos_group: 'RB' },
  WRs: [
    { player: 'Neutral WR1', tier: 7, pos_group: 'WR' },
    { player: 'Neutral WR2', tier: 7, pos_group: 'WR' },
  ],
  TE: { player: 'Neutral TE', tier: 7, pos_group: 'TE' },
  OL: { player: 'Neutral OL', tier: 7, pos_group: 'OL' },
  DL: { player: 'Neutral DL', tier: 7, pos_group: 'DL' },
  LB: { player: 'Neutral LB', tier: 7, pos_group: 'LB' },
  DBs: [
    { player: 'Neutral DB1', tier: 7, pos_group: 'DB' },
    { player: 'Neutral DB2', tier: 7, pos_group: 'DB' },
  ],
  K: { player: 'Neutral K', tier: 7, pos_group: 'K' },
};

// =============================================================================
// RUN SIMULATION WITH FORCED STRATEGIES
// =============================================================================

function runGamesForced(numGames, homeOffense, homeDefense, awayOffense, awayDefense) {
  let homeWins = 0;
  let totalHomePts = 0;
  let totalAwayPts = 0;

  for (let i = 0; i < numGames; i++) {
    // Use forceBalanced flags and options to control strategy
    // But since we want to force specific strategies, we'll need to 
    // look at what the engine does with identical rosters
    const result = simulateGameCore(NEUTRAL_ROSTER, NEUTRAL_ROSTER, {
      homeForceBalanced: homeOffense === 'balanced' && homeDefense === 'base_defense',
      awayForceBalanced: awayOffense === 'balanced' && awayDefense === 'base_defense',
    });
    
    if (result.homeScore > result.awayScore) homeWins++;
    totalHomePts += result.homeScore;
    totalAwayPts += result.awayScore;
  }

  return {
    winRate: (homeWins / numGames * 100).toFixed(1),
    avgPtsFor: (totalHomePts / numGames).toFixed(1),
    avgPtsAgainst: (totalAwayPts / numGames).toFixed(1),
    wins: homeWins,
    losses: numGames - homeWins,
  };
}

// =============================================================================
// ACTUAL TEST: Same rosters, different tier distributions
// =============================================================================

const NUM_GAMES = 500;

console.log('='.repeat(70));
console.log('ISOLATED STRATEGY TEST');
console.log('='.repeat(70));
console.log('All rosters at SAME total tier budget (42 offense, 28 defense)');
console.log('Comparing how DISTRIBUTION affects outcomes\n');

// Build distinct rosters with same tier totals
const PASS_BUILD = {
  QB: { player: 'QB', tier: 9, pos_group: 'QB' },
  RB: { player: 'RB', tier: 5, pos_group: 'RB' },
  WRs: [
    { player: 'WR1', tier: 9, pos_group: 'WR' },
    { player: 'WR2', tier: 8, pos_group: 'WR' },
  ],
  TE: { player: 'TE', tier: 6, pos_group: 'TE' },
  OL: { player: 'OL', tier: 5, pos_group: 'OL' },
  // 9+5+9+8+6+5 = 42
  DL: { player: 'DL', tier: 6, pos_group: 'DL' },
  LB: { player: 'LB', tier: 6, pos_group: 'LB' },
  DBs: [
    { player: 'DB1', tier: 8, pos_group: 'DB' },
    { player: 'DB2', tier: 8, pos_group: 'DB' },
  ],
  // 6+6+8+8 = 28 (DB-heavy = coverage_shell)
  K: { player: 'K', tier: 5, pos_group: 'K' },
};

const RUN_BUILD = {
  QB: { player: 'QB', tier: 6, pos_group: 'QB' },
  RB: { player: 'RB', tier: 9, pos_group: 'RB' },
  WRs: [
    { player: 'WR1', tier: 6, pos_group: 'WR' },
    { player: 'WR2', tier: 5, pos_group: 'WR' },
  ],
  TE: { player: 'TE', tier: 7, pos_group: 'TE' },
  OL: { player: 'OL', tier: 9, pos_group: 'OL' },
  // 6+9+6+5+7+9 = 42
  DL: { player: 'DL', tier: 8, pos_group: 'DL' },
  LB: { player: 'LB', tier: 8, pos_group: 'LB' },
  DBs: [
    { player: 'DB1', tier: 6, pos_group: 'DB' },
    { player: 'DB2', tier: 6, pos_group: 'DB' },
  ],
  // 8+8+6+6 = 28 (DL/LB-heavy = run_stuff)
  K: { player: 'K', tier: 5, pos_group: 'K' },
};

const BALANCED_BUILD = {
  QB: { player: 'QB', tier: 7, pos_group: 'QB' },
  RB: { player: 'RB', tier: 7, pos_group: 'RB' },
  WRs: [
    { player: 'WR1', tier: 7, pos_group: 'WR' },
    { player: 'WR2', tier: 7, pos_group: 'WR' },
  ],
  TE: { player: 'TE', tier: 7, pos_group: 'TE' },
  OL: { player: 'OL', tier: 7, pos_group: 'OL' },
  // 7*6 = 42
  DL: { player: 'DL', tier: 7, pos_group: 'DL' },
  LB: { player: 'LB', tier: 7, pos_group: 'LB' },
  DBs: [
    { player: 'DB1', tier: 7, pos_group: 'DB' },
    { player: 'DB2', tier: 7, pos_group: 'DB' },
  ],
  // 7*4 = 28
  K: { player: 'K', tier: 5, pos_group: 'K' },
};

function runMatchup(homeRoster, awayRoster, homeName, awayName) {
  let homeWins = 0;
  let totalHomePts = 0;
  let totalAwayPts = 0;

  for (let i = 0; i < NUM_GAMES; i++) {
    const result = simulateGameCore(homeRoster, awayRoster);
    if (result.homeScore > result.awayScore) homeWins++;
    totalHomePts += result.homeScore;
    totalAwayPts += result.awayScore;
  }

  return {
    matchup: `${homeName} vs ${awayName}`,
    winRate: (homeWins / NUM_GAMES * 100).toFixed(1),
    avgScore: `${(totalHomePts / NUM_GAMES).toFixed(1)}-${(totalAwayPts / NUM_GAMES).toFixed(1)}`,
  };
}

// Verify strategies derived
console.log('DERIVED STRATEGIES:');
console.log('-'.repeat(50));
const passRatings = calculateTeamRatings(PASS_BUILD);
const runRatings = calculateTeamRatings(RUN_BUILD);
const balRatings = calculateTeamRatings(BALANCED_BUILD);

const { getOffensiveStrategyFromRatings, getDefensiveStrategyFromRatings } = require('./playstyle');
console.log(`PASS_BUILD:     Off=${getOffensiveStrategyFromRatings(passRatings.offense)}, Def=${getDefensiveStrategyFromRatings(passRatings.defense)}`);
console.log(`RUN_BUILD:      Off=${getOffensiveStrategyFromRatings(runRatings.offense)}, Def=${getDefensiveStrategyFromRatings(runRatings.defense)}`);
console.log(`BALANCED_BUILD: Off=${getOffensiveStrategyFromRatings(balRatings.offense)}, Def=${getDefensiveStrategyFromRatings(balRatings.defense)}`);
console.log();

// =============================================================================
// HEAD-TO-HEAD MATCHUPS
// =============================================================================

console.log('='.repeat(70));
console.log('HEAD-TO-HEAD RESULTS (500 games each)');
console.log('='.repeat(70));
console.log();

const matchups = [
  // Pass vs others
  runMatchup(PASS_BUILD, RUN_BUILD, 'PASS', 'RUN'),
  runMatchup(PASS_BUILD, BALANCED_BUILD, 'PASS', 'BALANCED'),
  runMatchup(PASS_BUILD, PASS_BUILD, 'PASS', 'PASS (mirror)'),
  
  // Run vs others  
  runMatchup(RUN_BUILD, PASS_BUILD, 'RUN', 'PASS'),
  runMatchup(RUN_BUILD, BALANCED_BUILD, 'RUN', 'BALANCED'),
  runMatchup(RUN_BUILD, RUN_BUILD, 'RUN', 'RUN (mirror)'),
  
  // Balanced vs others
  runMatchup(BALANCED_BUILD, PASS_BUILD, 'BALANCED', 'PASS'),
  runMatchup(BALANCED_BUILD, RUN_BUILD, 'BALANCED', 'RUN'),
  runMatchup(BALANCED_BUILD, BALANCED_BUILD, 'BALANCED', 'BALANCED (mirror)'),
];

for (const m of matchups) {
  console.log(`${m.matchup.padEnd(30)} Win: ${m.winRate}%  Score: ${m.avgScore}`);
}

// =============================================================================
// SUMMARY MATRIX
// =============================================================================

console.log('\n' + '='.repeat(70));
console.log('WIN RATE MATRIX (row = Home, column = Away)');
console.log('='.repeat(70));
console.log('                  vs PASS    vs RUN    vs BALANCED');
console.log(`PASS              ${matchups[2].winRate.padStart(5)}%    ${matchups[0].winRate.padStart(5)}%    ${matchups[1].winRate.padStart(5)}%`);
console.log(`RUN               ${matchups[3].winRate.padStart(5)}%    ${matchups[5].winRate.padStart(5)}%    ${matchups[4].winRate.padStart(5)}%`);
console.log(`BALANCED          ${matchups[6].winRate.padStart(5)}%    ${matchups[7].winRate.padStart(5)}%    ${matchups[8].winRate.padStart(5)}%`);

// Calculate overall performance
const passTotal = parseFloat(matchups[0].winRate) + parseFloat(matchups[1].winRate) + parseFloat(matchups[2].winRate);
const runTotal = parseFloat(matchups[3].winRate) + parseFloat(matchups[4].winRate) + parseFloat(matchups[5].winRate);
const balTotal = parseFloat(matchups[6].winRate) + parseFloat(matchups[7].winRate) + parseFloat(matchups[8].winRate);

console.log('\n' + '='.repeat(70));
console.log('OVERALL (avg win rate across all matchups)');
console.log('='.repeat(70));
console.log(`PASS:     ${(passTotal/3).toFixed(1)}%`);
console.log(`RUN:      ${(runTotal/3).toFixed(1)}%`);
console.log(`BALANCED: ${(balTotal/3).toFixed(1)}%`);
