#!/usr/bin/env node
/**
 * Player-Level Boost Simulation
 * ==============================
 * Tests the proposed player-level strategy boost system and compares to baseline.
 *
 * Usage:
 *   node player-boost-sim.js
 *   node player-boost-sim.js --games=500
 */

const { simulateGame, createTestRoster, calculateTeamRatings } = require('./index');

// =============================================================================
// STRATEGY BOOST TABLE (proposed)
// =============================================================================
// Offense strategy + opponent defense strategy -> position boosts
// Advantage = your offense beats their defense type
// Captured = their defense beats your offense type

const STRATEGY_BOOSTS = {
  pass_heavy: {
    base_defense:    { QB: +0.3, WR: +0.3 },  // advantage: base loses to pass_heavy
    coverage_shell:  { QB: -0.3, WR: -0.3 },  // captured: coverage beats pass_heavy
    run_stuff:       {},                       // neutral
  },
  balanced: {
    run_stuff:       { QB: +0.2, WR: +0.1, RB: +0.2, OL: +0.1 }, // advantage: run_stuff loses to balanced
    base_defense:    { QB: -0.2, WR: -0.1, RB: -0.2, OL: -0.1 }, // captured: base beats balanced
    coverage_shell:  {},                       // neutral
  },
  run_heavy: {
    coverage_shell:  { RB: +0.3, OL: +0.3 },  // advantage: coverage loses to run
    run_stuff:       { RB: -0.3, OL: -0.3 },  // captured: run_stuff beats run
    base_defense:    {},                       // neutral
  },
};

// Defense strategy + opponent offense strategy -> position boosts
const DEFENSE_BOOSTS = {
  coverage_shell: {
    pass_heavy:   { DB: +0.3 },               // advantage: coverage beats pass
    run_heavy: { DB: -0.3 },               // captured: run beats coverage
    balanced:     {},
  },
  run_stuff: {
    run_heavy: { DL: +0.3, LB: +0.3 },     // advantage: run_stuff beats run
    balanced:     { DL: -0.2, LB: -0.2 },     // captured: balanced beats run_stuff
    pass_heavy:   {},
  },
  base_defense: {
    balanced:     { DL: +0.2, LB: +0.2, DB: +0.2 }, // advantage: base beats balanced
    pass_heavy:   { DL: -0.2, LB: -0.2, DB: -0.2 }, // captured: pass beats base
    run_heavy: {},
  },
};

// =============================================================================
// ROSTER HELPERS
// =============================================================================

function tierSum(roster) {
  const t = (p) => (p && typeof p.tier === 'number' ? p.tier : 5);
  const sum = (acc, p) => acc + t(p);
  let total = 0;
  if (roster.QB) total += t(roster.QB);
  if (roster.RBs) total += roster.RBs.reduce(sum, 0);
  if (roster.WRs) total += roster.WRs.reduce(sum, 0);
  if (roster.TE) total += t(roster.TE);
  if (roster.OLs) total += roster.OLs.reduce(sum, 0);
  if (roster.DLs) total += roster.DLs.reduce(sum, 0);
  if (roster.LBs) total += roster.LBs.reduce(sum, 0);
  if (roster.DBs) total += roster.DBs.reduce(sum, 0);
  if (roster.K) total += t(roster.K);
  if (roster.P) total += t(roster.P);
  return total;
}

function applyTierCap(roster, maxTierSum) {
  const sum = tierSum(roster);
  if (sum <= maxTierSum) return roster;
  const scale = maxTierSum / sum;
  const scaleTier = (t) => Math.max(1, Math.min(10, Math.round((t ?? 5) * scale)));
  const mapP = (p) => (p ? { ...p, tier: scaleTier(p.tier) } : p);
  const mapArr = (arr) => (Array.isArray(arr) ? arr.map(mapP) : arr);
  return {
    ...roster,
    QB: mapP(roster.QB),
    RBs: mapArr(roster.RBs),
    WRs: mapArr(roster.WRs),
    TE: mapP(roster.TE),
    OLs: mapArr(roster.OLs),
    DLs: mapArr(roster.DLs),
    LBs: mapArr(roster.LBs),
    DBs: mapArr(roster.DBs),
    K: mapP(roster.K),
    P: mapP(roster.P),
  };
}

function createRosterWithStrategies(offKey, defKey) {
  const d = 5;
  const off =
    offKey === 'pass_heavy' ? { QB: 8, RB: 4, WR: 8, TE: 6, OL: 4 }
    : offKey === 'run_heavy' ? { QB: 4, RB: 8, WR: 4, TE: 6, OL: 8 }
    : { QB: 6, RB: 6, WR: 6, TE: 6, OL: 6 };
  const def =
    defKey === 'coverage_shell' ? { DL: 4, LB: 4, DB: 8 }
    : defKey === 'run_stuff' ? { DL: 8, LB: 8, DB: 4 }
    : { DL: 6, LB: 6, DB: 6 };
  return createTestRoster({ ...off, ...def, K: 6, P: 5 });
}

// =============================================================================
// APPLY PLAYER-LEVEL BOOSTS
// =============================================================================

function applyBoosts(roster, boosts) {
  if (!boosts || Object.keys(boosts).length === 0) return roster;

  const clamp = (t) => Math.max(1, Math.min(10, t));
  const boost = (p, key) => {
    if (!p) return p;
    const b = boosts[key] || 0;
    return { ...p, tier: clamp(p.tier + b) };
  };
  const boostArr = (arr, key) => (Array.isArray(arr) ? arr.map((p) => boost(p, key)) : arr);

  return {
    ...roster,
    QB: boost(roster.QB, 'QB'),
    RBs: boostArr(roster.RBs, 'RB'),
    WRs: boostArr(roster.WRs, 'WR'),
    TE: boost(roster.TE, 'TE'),
    OLs: boostArr(roster.OLs, 'OL'),
    DLs: boostArr(roster.DLs, 'DL'),
    LBs: boostArr(roster.LBs, 'LB'),
    DBs: boostArr(roster.DBs, 'DB'),
    K: boost(roster.K, 'K'),
    P: boost(roster.P, 'P'),
  };
}

function applyStrategyBoosts(roster, myOffense, oppDefense, myDefense, oppOffense) {
  // Apply offensive boosts based on opponent's defense
  const offBoosts = STRATEGY_BOOSTS[myOffense]?.[oppDefense] || {};
  // Apply defensive boosts based on opponent's offense
  const defBoosts = DEFENSE_BOOSTS[myDefense]?.[oppOffense] || {};
  // Merge boosts
  const merged = { ...offBoosts };
  for (const [k, v] of Object.entries(defBoosts)) {
    merged[k] = (merged[k] || 0) + v;
  }
  return applyBoosts(roster, merged);
}

// =============================================================================
// SIMULATION
// =============================================================================

function runMatchup(userOff, userDef, oppOff, oppDef, numGames, tierCap = null) {
  let userRoster = createRosterWithStrategies(userOff, userDef);
  let oppRoster = createRosterWithStrategies(oppOff, oppDef);

  // Normalize both rosters to same tier sum (user's sum or cap, whichever is lower)
  const targetSum = tierCap != null ? tierCap : tierSum(userRoster);
  userRoster = applyTierCap(userRoster, targetSum);
  oppRoster = applyTierCap(oppRoster, targetSum);

  // Apply player-level boosts
  const userBoosted = applyStrategyBoosts(userRoster, userOff, oppDef, userDef, oppOff);
  const oppBoosted = applyStrategyBoosts(oppRoster, oppOff, userDef, oppDef, userOff);

  let userWins = 0;
  let userPts = 0, oppPts = 0;

  for (let i = 0; i < numGames; i++) {
    const result = simulateGame(userBoosted, oppBoosted);
    if (result.winner === 'home') userWins++;
    userPts += result.homeScore;
    oppPts += result.awayScore;
  }

  return {
    userWinPct: userWins / numGames,
    avgUserPts: userPts / numGames,
    avgOppPts: oppPts / numGames,
    avgPtDiff: (userPts - oppPts) / numGames,
  };
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const args = process.argv.slice(2);
  const numGames = parseInt(args.find((a) => a.startsWith('--games='))?.split('=')[1] || '500', 10);

  console.log('Player-Level Boost Simulation');
  console.log('==============================');
  console.log(`Games per matchup: ${numGames}\n`);

  // Test pass_heavy user vs different defenses (base_defense = advantage, coverage_shell = captured)
  console.log('='.repeat(80));
  console.log('PASS HEAVY OFFENSE: advantage vs captured');
  console.log('='.repeat(80));
  console.log('\nUser: pass_heavy O, base_defense D');
  console.log('Opponent: balanced O, defense varies\n');

  const caps = [null, 120, 100, 90, 80];
  const passHeavyResults = {};

  for (const cap of caps) {
    const label = cap == null ? 'No cap' : `≤${cap}`;
    const advantage = runMatchup('pass_heavy', 'base_defense', 'balanced', 'base_defense', numGames, cap);
    const captured = runMatchup('pass_heavy', 'base_defense', 'balanced', 'coverage_shell', numGames, cap);
    const neutral = runMatchup('pass_heavy', 'base_defense', 'balanced', 'run_stuff', numGames, cap);
    passHeavyResults[label] = { advantage, captured, neutral };
  }

  console.log('Tier cap    | Advantage (vs base_def) | Captured (vs coverage) | Neutral (vs run_stuff) | Swing (pp)');
  console.log('-'.repeat(100));
  for (const [label, r] of Object.entries(passHeavyResults)) {
    const adv = (r.advantage.userWinPct * 100).toFixed(1);
    const cap = (r.captured.userWinPct * 100).toFixed(1);
    const neu = (r.neutral.userWinPct * 100).toFixed(1);
    const swing = (r.advantage.userWinPct - r.captured.userWinPct) * 100;
    console.log(`${label.padEnd(11)} | ${adv.padStart(23)}% | ${cap.padStart(22)}% | ${neu.padStart(22)}% | ${swing.toFixed(1)}`);
  }

  // Test run_heavy user vs different defenses
  console.log('\n' + '='.repeat(80));
  console.log('RUN HEAVY OFFENSE: advantage vs captured');
  console.log('='.repeat(80));
  console.log('\nUser: run_heavy O, base_defense D');
  console.log('Opponent: balanced O, defense varies\n');

  const runHeavyResults = {};
  for (const cap of caps) {
    const label = cap == null ? 'No cap' : `≤${cap}`;
    const advantage = runMatchup('run_heavy', 'base_defense', 'balanced', 'coverage_shell', numGames, cap);
    const captured = runMatchup('run_heavy', 'base_defense', 'balanced', 'run_stuff', numGames, cap);
    const neutral = runMatchup('run_heavy', 'base_defense', 'balanced', 'base_defense', numGames, cap);
    runHeavyResults[label] = { advantage, captured, neutral };
  }

  console.log('Tier cap    | Advantage (vs coverage) | Captured (vs run_stuff) | Neutral (vs base_def) | Swing (pp)');
  console.log('-'.repeat(100));
  for (const [label, r] of Object.entries(runHeavyResults)) {
    const adv = (r.advantage.userWinPct * 100).toFixed(1);
    const cap = (r.captured.userWinPct * 100).toFixed(1);
    const neu = (r.neutral.userWinPct * 100).toFixed(1);
    const swing = (r.advantage.userWinPct - r.captured.userWinPct) * 100;
    console.log(`${label.padEnd(11)} | ${adv.padStart(23)}% | ${cap.padStart(23)}% | ${neu.padStart(21)}% | ${swing.toFixed(1)}`);
  }

  // Test balanced user vs different defenses
  console.log('\n' + '='.repeat(80));
  console.log('BALANCED OFFENSE: advantage vs captured');
  console.log('='.repeat(80));
  console.log('\nUser: balanced O, base_defense D');
  console.log('Opponent: balanced O, defense varies\n');

  const balancedResults = {};
  for (const cap of caps) {
    const label = cap == null ? 'No cap' : `≤${cap}`;
    const advantage = runMatchup('balanced', 'base_defense', 'balanced', 'run_stuff', numGames, cap);
    const captured = runMatchup('balanced', 'base_defense', 'balanced', 'base_defense', numGames, cap);
    const neutral = runMatchup('balanced', 'base_defense', 'balanced', 'coverage_shell', numGames, cap);
    balancedResults[label] = { advantage, captured, neutral };
  }

  console.log('Tier cap    | Advantage (vs run_stuff) | Captured (vs base_def) | Neutral (vs coverage) | Swing (pp)');
  console.log('-'.repeat(100));
  for (const [label, r] of Object.entries(balancedResults)) {
    const adv = (r.advantage.userWinPct * 100).toFixed(1);
    const cap = (r.captured.userWinPct * 100).toFixed(1);
    const neu = (r.neutral.userWinPct * 100).toFixed(1);
    const swing = (r.advantage.userWinPct - r.captured.userWinPct) * 100;
    console.log(`${label.padEnd(11)} | ${adv.padStart(24)}% | ${cap.padStart(22)}% | ${neu.padStart(21)}% | ${swing.toFixed(1)}`);
  }

  // Summary table
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY: Strategy swing by offense type and tier cap');
  console.log('='.repeat(80));
  console.log('\nSwing = Advantage win% - Captured win% (higher = strategy matters more)\n');

  console.log('Tier cap    | Pass Heavy swing | Run Dominant swing | Balanced swing | Average swing');
  console.log('-'.repeat(85));
  for (const cap of caps) {
    const label = cap == null ? 'No cap' : `≤${cap}`;
    const ph = passHeavyResults[label];
    const rd = runDominantResults[label];
    const ba = balancedResults[label];
    const phSwing = (ph.advantage.userWinPct - ph.captured.userWinPct) * 100;
    const rdSwing = (rd.advantage.userWinPct - rd.captured.userWinPct) * 100;
    const baSwing = (ba.advantage.userWinPct - ba.captured.userWinPct) * 100;
    const avg = (phSwing + rdSwing + baSwing) / 3;
    console.log(`${label.padEnd(11)} | ${phSwing.toFixed(1).padStart(16)} | ${rdSwing.toFixed(1).padStart(18)} | ${baSwing.toFixed(1).padStart(14)} | ${avg.toFixed(1)}`);
  }

  console.log('\nDone.');
}

main();
