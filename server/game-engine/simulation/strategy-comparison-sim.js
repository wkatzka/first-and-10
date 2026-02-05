/**
 * Strategy Comparison Simulation
 * ================================
 * Compares balanced vs specialized strategies using realistic rosters.
 * 
 * Usage: node strategy-comparison-sim.js
 */

const { simulateGame, createTestRoster } = require('./index');
const { 
  getOffensiveStrategyFromRatings, 
  getDefensiveStrategyFromRatings,
  calculateTeamRatings 
} = require('./playstyle');

// =============================================================================
// REALISTIC ROSTER BUILDS (all at 42 offense cap, 28 defense cap)
// =============================================================================

// Pass-Heavy Build: Stack QB + WRs, sacrifice RB/OL
const PASS_HEAVY_ROSTER = {
  QB: { player: 'Elite Passer', tier: 9, pos_group: 'QB' },
  RB: { player: 'Budget RB', tier: 5, pos_group: 'RB' },
  WRs: [
    { player: 'Star WR1', tier: 9, pos_group: 'WR' },
    { player: 'Good WR2', tier: 8, pos_group: 'WR' },
  ],
  TE: { player: 'Avg TE', tier: 6, pos_group: 'TE' },
  OL: { player: 'Budget OL', tier: 5, pos_group: 'OL' },
  // Offense total: 9+5+9+8+6+5 = 42 ✓
  DL: { player: 'Avg DL', tier: 7, pos_group: 'DL' },
  LB: { player: 'Avg LB', tier: 7, pos_group: 'LB' },
  DBs: [
    { player: 'Good DB1', tier: 7, pos_group: 'DB' },
    { player: 'Good DB2', tier: 7, pos_group: 'DB' },
  ],
  // Defense total: 7+7+7+7 = 28 ✓
  K: { player: 'Kicker', tier: 5, pos_group: 'K' },
};

// Run-Heavy Build: Stack RB + OL, sacrifice WRs
const RUN_HEAVY_ROSTER = {
  QB: { player: 'Mobile QB', tier: 6, pos_group: 'QB' },
  RB: { player: 'Star RB', tier: 9, pos_group: 'RB' },
  WRs: [
    { player: 'Budget WR1', tier: 6, pos_group: 'WR' },
    { player: 'Budget WR2', tier: 5, pos_group: 'WR' },
  ],
  TE: { player: 'Blocking TE', tier: 7, pos_group: 'TE' },
  OL: { player: 'Elite OL', tier: 9, pos_group: 'OL' },
  // Offense total: 6+9+6+5+7+9 = 42 ✓
  DL: { player: 'Strong DL', tier: 8, pos_group: 'DL' },
  LB: { player: 'Strong LB', tier: 8, pos_group: 'LB' },
  DBs: [
    { player: 'Avg DB1', tier: 6, pos_group: 'DB' },
    { player: 'Avg DB2', tier: 6, pos_group: 'DB' },
  ],
  // Defense total: 8+8+6+6 = 28 ✓
  K: { player: 'Kicker', tier: 5, pos_group: 'K' },
};

// Balanced Build: Even distribution
const BALANCED_ROSTER = {
  QB: { player: 'Solid QB', tier: 7, pos_group: 'QB' },
  RB: { player: 'Solid RB', tier: 7, pos_group: 'RB' },
  WRs: [
    { player: 'Solid WR1', tier: 7, pos_group: 'WR' },
    { player: 'Solid WR2', tier: 7, pos_group: 'WR' },
  ],
  TE: { player: 'Solid TE', tier: 7, pos_group: 'TE' },
  OL: { player: 'Solid OL', tier: 7, pos_group: 'OL' },
  // Offense total: 7*6 = 42 ✓
  DL: { player: 'Solid DL', tier: 7, pos_group: 'DL' },
  LB: { player: 'Solid LB', tier: 7, pos_group: 'LB' },
  DBs: [
    { player: 'Solid DB1', tier: 7, pos_group: 'DB' },
    { player: 'Solid DB2', tier: 7, pos_group: 'DB' },
  ],
  // Defense total: 7*4 = 28 ✓
  K: { player: 'Kicker', tier: 5, pos_group: 'K' },
};

// =============================================================================
// OPPONENT ROSTERS (variety of builds)
// =============================================================================

const OPPONENTS = [
  { name: 'Pass-Heavy Opponent', roster: PASS_HEAVY_ROSTER },
  { name: 'Run-Heavy Opponent', roster: RUN_HEAVY_ROSTER },
  { name: 'Balanced Opponent', roster: BALANCED_ROSTER },
];

// =============================================================================
// SIMULATION FUNCTIONS
// =============================================================================

function runGames(homeRoster, awayRoster, numGames, options = {}) {
  let homeWins = 0;
  let totalHomePts = 0;
  let totalAwayPts = 0;

  for (let i = 0; i < numGames; i++) {
    const result = simulateGame(homeRoster, awayRoster, options);
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

function getDerivedStrategy(roster) {
  const ratings = calculateTeamRatings(roster);
  return {
    offense: getOffensiveStrategyFromRatings(ratings.offense),
    defense: getDefensiveStrategyFromRatings(ratings.defense),
  };
}

// =============================================================================
// MAIN SIMULATION
// =============================================================================

const NUM_GAMES = 500;

console.log('='.repeat(70));
console.log('STRATEGY COMPARISON SIMULATION');
console.log('='.repeat(70));
console.log(`Running ${NUM_GAMES} games per matchup\n`);

// Show what strategy each roster naturally derives
console.log('ROSTER STRATEGIES (derived from composition):');
console.log('-'.repeat(50));
const passStrat = getDerivedStrategy(PASS_HEAVY_ROSTER);
const runStrat = getDerivedStrategy(RUN_HEAVY_ROSTER);
const balStrat = getDerivedStrategy(BALANCED_ROSTER);
console.log(`Pass-Heavy:  Offense=${passStrat.offense}, Defense=${passStrat.defense}`);
console.log(`Run-Heavy:   Offense=${runStrat.offense}, Defense=${runStrat.defense}`);
console.log(`Balanced:    Offense=${balStrat.offense}, Defense=${balStrat.defense}`);
console.log();

// =============================================================================
// SIM 1: Team A uses BALANCED roster against all opponents
// =============================================================================

console.log('='.repeat(70));
console.log('SIM 1: BALANCED TEAM vs ALL OPPONENTS');
console.log('='.repeat(70));
console.log('Team A uses: BALANCED roster (T7 across all positions)\n');

let balancedTotalWins = 0;
let balancedTotalGames = 0;

for (const opponent of OPPONENTS) {
  const result = runGames(BALANCED_ROSTER, opponent.roster, NUM_GAMES);
  console.log(`vs ${opponent.name.padEnd(25)} Win: ${result.winRate}% (${result.wins}-${result.losses})  Pts: ${result.avgPtsFor}-${result.avgPtsAgainst}`);
  balancedTotalWins += result.wins;
  balancedTotalGames += NUM_GAMES;
}

const balancedOverallWinRate = (balancedTotalWins / balancedTotalGames * 100).toFixed(1);
console.log('-'.repeat(60));
console.log(`BALANCED OVERALL: ${balancedOverallWinRate}% win rate (${balancedTotalWins}/${balancedTotalGames})`);

// =============================================================================
// SIM 2: Team A uses SPECIALIZED roster that MATCHES opponent
// (Pass-heavy vs Run defense, Run-heavy vs Pass defense, etc.)
// =============================================================================

console.log('\n' + '='.repeat(70));
console.log('SIM 2: SPECIALIZED TEAM (counter-picking opponents)');
console.log('='.repeat(70));
console.log('Team A picks roster to exploit opponent weakness:\n');

let specializedTotalWins = 0;
let specializedTotalGames = 0;

// vs Pass-Heavy opponent -> use Run-Heavy (run beats coverage defense likely)
const vsPassResult = runGames(RUN_HEAVY_ROSTER, PASS_HEAVY_ROSTER, NUM_GAMES);
console.log(`RUN-HEAVY vs Pass-Heavy Opp     Win: ${vsPassResult.winRate}% (${vsPassResult.wins}-${vsPassResult.losses})  Pts: ${vsPassResult.avgPtsFor}-${vsPassResult.avgPtsAgainst}`);
specializedTotalWins += vsPassResult.wins;

// vs Run-Heavy opponent -> use Pass-Heavy (pass beats run defense likely)
const vsRunResult = runGames(PASS_HEAVY_ROSTER, RUN_HEAVY_ROSTER, NUM_GAMES);
console.log(`PASS-HEAVY vs Run-Heavy Opp     Win: ${vsRunResult.winRate}% (${vsRunResult.wins}-${vsRunResult.losses})  Pts: ${vsRunResult.avgPtsFor}-${vsRunResult.avgPtsAgainst}`);
specializedTotalWins += vsRunResult.wins;

// vs Balanced opponent -> use Pass-Heavy (pass generally more explosive)
const vsBalResult = runGames(PASS_HEAVY_ROSTER, BALANCED_ROSTER, NUM_GAMES);
console.log(`PASS-HEAVY vs Balanced Opp      Win: ${vsBalResult.winRate}% (${vsBalResult.wins}-${vsBalResult.losses})  Pts: ${vsBalResult.avgPtsFor}-${vsBalResult.avgPtsAgainst}`);
specializedTotalWins += vsBalResult.wins;

specializedTotalGames = NUM_GAMES * 3;
const specializedOverallWinRate = (specializedTotalWins / specializedTotalGames * 100).toFixed(1);
console.log('-'.repeat(60));
console.log(`SPECIALIZED OVERALL: ${specializedOverallWinRate}% win rate (${specializedTotalWins}/${specializedTotalGames})`);

// =============================================================================
// SIM 3: Team A uses WRONG specialized roster (gets countered)
// =============================================================================

console.log('\n' + '='.repeat(70));
console.log('SIM 3: SPECIALIZED TEAM (getting counter-picked)');
console.log('='.repeat(70));
console.log('Team A picks roster that gets COUNTERED by opponent:\n');

let counteredTotalWins = 0;

// Pass-Heavy vs Pass-Heavy opponent (coverage defense counters our pass)
const counterPass = runGames(PASS_HEAVY_ROSTER, PASS_HEAVY_ROSTER, NUM_GAMES);
console.log(`PASS-HEAVY vs Pass-Heavy Opp    Win: ${counterPass.winRate}% (${counterPass.wins}-${counterPass.losses})  Pts: ${counterPass.avgPtsFor}-${counterPass.avgPtsAgainst}`);
counteredTotalWins += counterPass.wins;

// Run-Heavy vs Run-Heavy opponent (run_stuff defense counters our run)
const counterRun = runGames(RUN_HEAVY_ROSTER, RUN_HEAVY_ROSTER, NUM_GAMES);
console.log(`RUN-HEAVY vs Run-Heavy Opp      Win: ${counterRun.winRate}% (${counterRun.wins}-${counterRun.losses})  Pts: ${counterRun.avgPtsFor}-${counterRun.avgPtsAgainst}`);
counteredTotalWins += counterRun.wins;

// Run-Heavy vs Balanced (balanced may beat run_stuff offense)
const counterBal = runGames(RUN_HEAVY_ROSTER, BALANCED_ROSTER, NUM_GAMES);
console.log(`RUN-HEAVY vs Balanced Opp       Win: ${counterBal.winRate}% (${counterBal.wins}-${counterBal.losses})  Pts: ${counterBal.avgPtsFor}-${counterBal.avgPtsAgainst}`);
counteredTotalWins += counterBal.wins;

const counteredTotalGames = NUM_GAMES * 3;
const counteredOverallWinRate = (counteredTotalWins / counteredTotalGames * 100).toFixed(1);
console.log('-'.repeat(60));
console.log(`COUNTERED OVERALL: ${counteredOverallWinRate}% win rate (${counteredTotalWins}/${counteredTotalGames})`);

// =============================================================================
// SUMMARY
// =============================================================================

console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log(`BALANCED (safe):                ${balancedOverallWinRate}% win rate`);
console.log(`SPECIALIZED (counter-picking):  ${specializedOverallWinRate}% win rate`);
console.log(`SPECIALIZED (getting countered): ${counteredOverallWinRate}% win rate`);
console.log();
console.log('TAKEAWAY:');
if (parseFloat(specializedOverallWinRate) > parseFloat(balancedOverallWinRate)) {
  const diff = (parseFloat(specializedOverallWinRate) - parseFloat(balancedOverallWinRate)).toFixed(1);
  console.log(`  - Counter-picking gives +${diff}pp over balanced`);
}
if (parseFloat(balancedOverallWinRate) > parseFloat(counteredOverallWinRate)) {
  const diff = (parseFloat(balancedOverallWinRate) - parseFloat(counteredOverallWinRate)).toFixed(1);
  console.log(`  - Balanced beats getting countered by +${diff}pp`);
}
const swing = (parseFloat(specializedOverallWinRate) - parseFloat(counteredOverallWinRate)).toFixed(1);
console.log(`  - Total swing between best/worst specialization: ${swing}pp`);
