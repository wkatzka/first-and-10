/**
 * Forced Strategy Simulation
 * ===========================
 * Uses same tier-budget rosters with different distributions to isolate strategy effects.
 * Runs BIDIRECTIONAL matchups (A as home + A as away, averaged) to eliminate any
 * first-possession or positional bias.
 * 
 * Usage: node strategy-forced-sim.js
 */

const { simulateGame: simulateGameCore } = require('./game');
const { calculateTeamRatings } = require('./playstyle');

// =============================================================================
// ROSTERS (same total tier budget: 42 offense, 28 defense)
// =============================================================================

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

// =============================================================================
// BIDIRECTIONAL MATCHUP RUNNER
// =============================================================================

const NUM_GAMES = 3000; // 3000 total (1500 each direction) for ~0.9% std error

/**
 * Run a matchup bidirectionally: half with A as home, half with A as away.
 * Returns A's win rate averaged across both directions, with tie tracking.
 */
function runBidirectionalMatchup(rosterA, rosterB, nameA, nameB) {
  const half = Math.floor(NUM_GAMES / 2);
  let aWins = 0;
  let bWins = 0;
  let ties = 0;
  let totalAPts = 0;
  let totalBPts = 0;

  // Direction 1: A = home, B = away
  for (let i = 0; i < half; i++) {
    const result = simulateGameCore(rosterA, rosterB);
    if (result.homeScore > result.awayScore) aWins++;
    else if (result.awayScore > result.homeScore) bWins++;
    else ties++;
    totalAPts += result.homeScore;
    totalBPts += result.awayScore;
  }

  // Direction 2: A = away, B = home
  for (let i = 0; i < half; i++) {
    const result = simulateGameCore(rosterB, rosterA);
    if (result.awayScore > result.homeScore) aWins++;
    else if (result.homeScore > result.awayScore) bWins++;
    else ties++;
    totalAPts += result.awayScore;
    totalBPts += result.homeScore;
  }

  const decided = aWins + bWins;
  return {
    matchup: `${nameA} vs ${nameB}`,
    winRate: (aWins / NUM_GAMES * 100).toFixed(1),
    decidedWinRate: decided > 0 ? (aWins / decided * 100).toFixed(1) : '50.0',
    tieRate: (ties / NUM_GAMES * 100).toFixed(1),
    avgScore: `${(totalAPts / NUM_GAMES).toFixed(1)}-${(totalBPts / NUM_GAMES).toFixed(1)}`,
    wins: aWins,
    losses: bWins,
    ties,
  };
}

// =============================================================================
// VERIFY DERIVED STRATEGIES
// =============================================================================

console.log('='.repeat(70));
console.log('ISOLATED STRATEGY TEST (BIDIRECTIONAL - no home/away bias)');
console.log('='.repeat(70));
console.log('All rosters at SAME total tier budget (42 offense, 28 defense)');
console.log(`${NUM_GAMES} games per matchup (${NUM_GAMES/2} each direction)\n`);

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
// HEAD-TO-HEAD MATCHUPS (bidirectional)
// =============================================================================

console.log('='.repeat(70));
console.log(`HEAD-TO-HEAD RESULTS (${NUM_GAMES} games each, bidirectional)`);
console.log('='.repeat(70));
console.log();

const matchups = [
  // Pass vs others (Pass is "A" team)
  runBidirectionalMatchup(PASS_BUILD, PASS_BUILD, 'O:Pass D:Coverage', 'O:Pass D:Coverage (mirror)'),
  runBidirectionalMatchup(PASS_BUILD, RUN_BUILD, 'O:Pass D:Coverage', 'O:Run D:RunStuff'),
  runBidirectionalMatchup(PASS_BUILD, BALANCED_BUILD, 'O:Pass D:Coverage', 'O:Bal D:Base'),
  
  // Run vs others (Run is "A" team)
  runBidirectionalMatchup(RUN_BUILD, PASS_BUILD, 'O:Run D:RunStuff', 'O:Pass D:Coverage'),
  runBidirectionalMatchup(RUN_BUILD, BALANCED_BUILD, 'O:Run D:RunStuff', 'O:Bal D:Base'),
  runBidirectionalMatchup(RUN_BUILD, RUN_BUILD, 'O:Run D:RunStuff', 'O:Run D:RunStuff (mirror)'),
  
  // Balanced vs others (Balanced is "A" team)
  runBidirectionalMatchup(BALANCED_BUILD, PASS_BUILD, 'O:Bal D:Base', 'O:Pass D:Coverage'),
  runBidirectionalMatchup(BALANCED_BUILD, RUN_BUILD, 'O:Bal D:Base', 'O:Run D:RunStuff'),
  runBidirectionalMatchup(BALANCED_BUILD, BALANCED_BUILD, 'O:Bal D:Base', 'O:Bal D:Base (mirror)'),
];

for (const m of matchups) {
  console.log(`${m.matchup.padEnd(55)} Win: ${m.winRate}% (decided: ${m.decidedWinRate}%)  Ties: ${m.tieRate}%  Score: ${m.avgScore}`);
}

// =============================================================================
// SUMMARY MATRIX
// =============================================================================

// =============================================================================
// FULL BUILD MATRIX (decided win rate, ties excluded)
// =============================================================================

console.log('\n' + '='.repeat(70));
console.log('FULL BUILD MATRIX - decided win % (row = your build, col = opponent)');
console.log('='.repeat(70));
console.log('                         vs O:Pass D:Cov   vs O:Run D:Stuff   vs O:Bal D:Base');
console.log(`O:Pass  D:Coverage       ${matchups[0].decidedWinRate.padStart(5)}%            ${matchups[1].decidedWinRate.padStart(5)}%            ${matchups[2].decidedWinRate.padStart(5)}%`);
console.log(`O:Run   D:RunStuff       ${matchups[3].decidedWinRate.padStart(5)}%            ${matchups[5].decidedWinRate.padStart(5)}%            ${matchups[4].decidedWinRate.padStart(5)}%`);
console.log(`O:Bal   D:Base           ${matchups[6].decidedWinRate.padStart(5)}%            ${matchups[7].decidedWinRate.padStart(5)}%            ${matchups[8].decidedWinRate.padStart(5)}%`);

// Calculate overall performance
const passTotal = parseFloat(matchups[0].decidedWinRate) + parseFloat(matchups[1].decidedWinRate) + parseFloat(matchups[2].decidedWinRate);
const runTotal = parseFloat(matchups[3].decidedWinRate) + parseFloat(matchups[4].decidedWinRate) + parseFloat(matchups[5].decidedWinRate);
const balTotal = parseFloat(matchups[6].decidedWinRate) + parseFloat(matchups[7].decidedWinRate) + parseFloat(matchups[8].decidedWinRate);

console.log('\nOVERALL (avg decided win rate):');
console.log(`  O:Pass  D:Coverage  ${(passTotal/3).toFixed(1)}%`);
console.log(`  O:Run   D:RunStuff  ${(runTotal/3).toFixed(1)}%`);
console.log(`  O:Bal   D:Base      ${(balTotal/3).toFixed(1)}%`);

// =============================================================================
// OFFENSE vs DEFENSE INTERACTION TABLE
// =============================================================================
// Shows what happens when each offensive strategy type faces each defensive
// strategy type, based on the boost multipliers and yardage modifiers.

console.log('\n' + '='.repeat(70));
console.log('OFFENSE vs DEFENSE INTERACTION TABLE');
console.log('='.repeat(70));
console.log('Shows tier boost + yardage modifier for each O vs D matchup.\n');

const { STRATEGY_BOOST_AMOUNT, OFFENSE_STRATEGY_BOOSTS, DEFENSE_STRATEGY_BOOSTS, STRATEGY_MATCHUP_MODIFIERS } = require('./constants');
const { getBoostMultiplier } = require('./playstyle');

const offStrategies = ['pass_heavy', 'balanced', 'run_heavy'];
const defStrategies = ['coverage_shell', 'base_defense', 'run_stuff'];
const offLabels = { pass_heavy: 'Pass Heavy', balanced: 'Balanced', run_heavy: 'Run Heavy' };
const defLabels = { coverage_shell: 'Coverage (Pass D)', base_defense: 'Base (Balanced D)', run_stuff: 'Run Stuff (Run D)' };

console.log('  YOUR OFFENSE        vs Coverage (Pass D)     vs Base (Balanced D)     vs Run Stuff (Run D)');
console.log('  ' + '-'.repeat(95));

for (const off of offStrategies) {
  const cells = [];
  for (const def of defStrategies) {
    const offResult = OFFENSE_STRATEGY_BOOSTS[off]?.[def] || 'neutral';
    const defResult = DEFENSE_STRATEGY_BOOSTS[def]?.[off] || 'neutral';
    const mods = STRATEGY_MATCHUP_MODIFIERS[def]?.[off] || { pass: 1.0, run: 1.0 };
    
    const offTag = offResult === 'advantage' ? 'ADV' : offResult === 'captured' ? 'CAP' :
                   offResult === 'slight_advantage' ? 'adv' : offResult === 'slight_captured' ? 'cap' : '---';
    const defTag = defResult === 'advantage' ? 'ADV' : defResult === 'captured' ? 'CAP' :
                   defResult === 'slight_advantage' ? 'adv' : defResult === 'slight_captured' ? 'cap' : '---';
    
    cells.push(`O:${offTag} D:${defTag}  p${mods.pass.toFixed(2)} r${mods.run.toFixed(2)}`);
  }
  console.log(`  ${offLabels[off].padEnd(22)}${cells.map(c => c.padEnd(25)).join('')}`);
}

console.log('\n  Key:');
console.log('    O:tag = your offense tier boost    D:tag = their defense tier boost');
console.log('    ADV = advantage (+6% tiers)        CAP = captured (-6% tiers)');
console.log('    adv = slight advantage (+1.2%)     cap = slight captured (-1.2%)');
console.log('    --- = neutral (no boost)');
console.log('    pX.XX = pass yard multiplier       rX.XX = run yard multiplier');

// =============================================================================
// TARGET CHECK
// =============================================================================

console.log('\n' + '='.repeat(70));
console.log('TARGET CHECK');
console.log('='.repeat(70));

// Use decided win rate (excluding ties) for target comparison
// Note: Head-to-head targets adjusted for coupled offense/defense strategies.
// In full-team matchups, each side has one advantage + one disadvantage,
// so the favorable side wins ~53-55% (not 57%) due to partial cancellation.
const targets = [
  { name: 'Pass vs Balanced', actual: parseFloat(matchups[2].decidedWinRate), target: 50, tolerance: 3 },
  { name: 'Run vs Balanced', actual: parseFloat(matchups[4].decidedWinRate), target: 50, tolerance: 3 },
  { name: 'Bal vs Balanced', actual: parseFloat(matchups[8].decidedWinRate), target: 50, tolerance: 3 },
  { name: 'Pass vs Run (head-to-head)', actual: parseFloat(matchups[1].decidedWinRate), target: 53, tolerance: 5 },
  { name: 'Run vs Pass (head-to-head)', actual: parseFloat(matchups[3].decidedWinRate), target: 47, tolerance: 5 },
  { name: 'Pass mirror', actual: parseFloat(matchups[0].decidedWinRate), target: 50, tolerance: 3 },
  { name: 'Run mirror', actual: parseFloat(matchups[5].decidedWinRate), target: 50, tolerance: 3 },
];

let allPass = true;
for (const t of targets) {
  const diff = Math.abs(t.actual - t.target);
  const status = diff <= t.tolerance ? 'OK' : 'MISS';
  if (status === 'MISS') allPass = false;
  console.log(`  ${status.padEnd(4)} ${t.name.padEnd(25)} ${t.actual}% (target: ${t.target}% +/-${t.tolerance})`);
}
console.log(`\n${allPass ? 'ALL TARGETS MET' : 'SOME TARGETS MISSED - tuning needed'}`);
