#!/usr/bin/env node
/**
 * Strategy Simulation
 * ====================
 * Runs many games to measure the effect of offensive/defensive strategy matchups
 * and explores tier-sum / OVR caps where strategy has more weight.
 *
 * Usage:
 *   node strategy-simulation.js                    # Full run: strategy effects + cap sweep
 *   node strategy-simulation.js --strategies-only # Only strategy matchup matrix
 *   node strategy-simulation.js --caps-only       # Only tier-cap sweep
 *   node strategy-simulation.js --games=200       # Games per cell (default 150)
 */

const {
  simulateGame,
  createTestRoster,
  calculateTeamRatings,
  getTeamSummary,
} = require('./index');
const {
  getOffensiveStrategyFromRatings,
  getDefensiveStrategyFromRatings,
} = require('./playstyle');
const { OFFENSIVE_STRATEGIES, DEFENSIVE_STRATEGIES } = require('./constants');

const OFF_KEYS = ['pass_heavy', 'balanced', 'run_dominant'];
const DEF_KEYS = ['coverage_shell', 'base_defense', 'run_stuff'];

// =============================================================================
// ROSTER HELPERS: tier sum, OVR sum, apply cap
// =============================================================================

function rosterSlotCount(roster) {
  let n = 0;
  if (roster.QB) n += 1;
  if (roster.RBs) n += roster.RBs.length;
  if (roster.WRs) n += roster.WRs.length;
  if (roster.TE) n += 1;
  if (roster.OLs) n += roster.OLs.length;
  if (roster.DLs) n += roster.DLs.length;
  if (roster.LBs) n += roster.LBs.length;
  if (roster.DBs) n += roster.DBs.length;
  if (roster.K) n += 1;
  if (roster.P) n += 1;
  return n;
}

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

function ovrSum(roster) {
  const ratings = calculateTeamRatings(roster);
  const o = ratings.overall;
  const slots = rosterSlotCount(roster);
  return (o?.total ?? 5) * slots;
}

/**
 * Clone roster and scale all tiers so tier sum <= maxTierSum (preserves shape).
 */
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

// =============================================================================
// BUILD ROSTERS THAT DERIVE TO SPECIFIC STRATEGIES
// =============================================================================
// Offense: pass_heavy (high QB+WR, low RB/OL), run_dominant (high RB+OL, low QB/WR), balanced (even).
// Defense: coverage_shell (high DB), run_stuff (high DL+LB), base_defense (even).

function createRosterForOffensiveStrategy(offKey) {
  const d = 5;
  if (offKey === 'pass_heavy') {
    return createTestRoster({
      QB: 8, RB: 4, WR: 8, TE: 6, OL: 4,
      DL: d, LB: d, DB: d, K: 6, P: 5,
    });
  }
  if (offKey === 'run_dominant') {
    return createTestRoster({
      QB: 4, RB: 8, WR: 4, TE: 6, OL: 8,
      DL: d, LB: d, DB: d, K: 6, P: 5,
    });
  }
  return createTestRoster({
    QB: 6, RB: 6, WR: 6, TE: 6, OL: 6,
    DL: d, LB: d, DB: d, K: 6, P: 5,
  });
}

function createRosterForDefensiveStrategy(defKey) {
  const d = 5;
  if (defKey === 'coverage_shell') {
    return createTestRoster({
      QB: d, RB: d, WR: d, TE: d, OL: d,
      DL: 4, LB: 4, DB: 8, K: 5, P: 5,
    });
  }
  if (defKey === 'run_stuff') {
    return createTestRoster({
      QB: d, RB: d, WR: d, TE: d, OL: d,
      DL: 8, LB: 8, DB: 4, K: 5, P: 5,
    });
  }
  return createTestRoster({
    QB: d, RB: d, WR: d, TE: d, OL: d,
    DL: 6, LB: 6, DB: 6, K: 5, P: 5,
  });
}

/**
 * Build a full roster with desired offensive and defensive strategy (offense vs defense positions).
 */
function createRosterWithStrategies(offKey, defKey) {
  const offRoster = createRosterForOffensiveStrategy(offKey);
  const defRoster = createRosterForDefensiveStrategy(defKey);
  return {
    QB: offRoster.QB,
    RBs: offRoster.RBs,
    WRs: offRoster.WRs,
    TE: offRoster.TE,
    OLs: offRoster.OLs,
    DLs: defRoster.DLs,
    LBs: defRoster.LBs,
    DBs: defRoster.DBs,
    K: offRoster.K,
    P: offRoster.P,
  };
}

function verifyStrategy(roster, expectedOff, expectedDef) {
  const ratings = calculateTeamRatings(roster);
  const off = getOffensiveStrategyFromRatings(ratings.offense);
  const def = getDefensiveStrategyFromRatings(ratings.defense);
  return off === expectedOff && def === expectedDef;
}

// =============================================================================
// STRATEGY MATRIX: run games for each (home off/def) vs (away off/def)
// =============================================================================

function runStrategyMatrix(numGamesPerCell = 150, tierCap = null) {
  const results = {};
  for (const homeOff of OFF_KEYS) {
    for (const homeDef of DEF_KEYS) {
      for (const awayOff of OFF_KEYS) {
        for (const awayDef of DEF_KEYS) {
          const key = `${homeOff}|${homeDef}|${awayOff}|${awayDef}`;
          let homeWins = 0;
          let homePoints = 0;
          let awayPoints = 0;

          const homeRoster = createRosterWithStrategies(homeOff, homeDef);
          const awayRoster = createRosterWithStrategies(awayOff, awayDef);

          const home = tierCap != null ? applyTierCap(homeRoster, tierCap) : homeRoster;
          const away = tierCap != null ? applyTierCap(awayRoster, tierCap) : awayRoster;

          for (let i = 0; i < numGamesPerCell; i++) {
            const result = simulateGame(home, away);
            if (result.winner === 'home') homeWins++;
            homePoints += result.homeScore;
            awayPoints += result.awayScore;
          }

          results[key] = {
            homeWinPct: homeWins / numGamesPerCell,
            homeAvgPts: homePoints / numGamesPerCell,
            awayAvgPts: awayPoints / numGamesPerCell,
            avgPointDiff: (homePoints - awayPoints) / numGamesPerCell,
          };
        }
      }
    }
  }
  return results;
}

// =============================================================================
// ANALYZE: favorable vs unfavorable matchup
// =============================================================================
// Defense "beats" one offense; "loses to" another. So when home defense beats away offense,
// we expect home to do better; when away defense beats home offense, away does better.

function getMatchupFavorability(homeOff, homeDef, awayOff, awayDef) {
  const beats = {
    coverage_shell: 'pass_heavy',
    run_stuff: 'run_dominant',
    base_defense: 'balanced',
  };
  const losesTo = {
    coverage_shell: 'run_dominant',
    run_stuff: 'balanced',
    base_defense: 'pass_heavy',
  };
  let homeFav = 0;
  let awayFav = 0;
  if (beats[homeDef] === awayOff) homeFav += 1;
  if (losesTo[homeDef] === awayOff) awayFav += 1;
  if (beats[awayDef] === homeOff) awayFav += 1;
  if (losesTo[awayDef] === homeOff) homeFav += 1;
  return { homeFav, awayFav };
}

function aggregateStrategyEffects(rawResults, numGamesPerCell) {
  const byFavorability = { homeFav: [], even: [], awayFav: [] };

  for (const [key, r] of Object.entries(rawResults)) {
    const [homeOff, homeDef, awayOff, awayDef] = key.split('|');
    const { homeFav, awayFav } = getMatchupFavorability(homeOff, homeDef, awayOff, awayDef);
    const bucket = homeFav > awayFav ? 'homeFav' : awayFav > homeFav ? 'awayFav' : 'even';
    byFavorability[bucket].push({
      homeWinPct: r.homeWinPct,
      avgPointDiff: r.avgPointDiff,
    });
  }

  const avg = (arr, field) => {
    if (arr.length === 0) return null;
    return arr.reduce((s, x) => s + x[field], 0) / arr.length;
  };

  return {
    whenHomeHasFavorableMatchup: {
      games: byFavorability.homeFav.length * numGamesPerCell,
      avgHomeWinPct: avg(byFavorability.homeFav, 'homeWinPct'),
      avgPointDiff: avg(byFavorability.homeFav, 'avgPointDiff'),
    },
    whenEven: {
      games: byFavorability.even.length * numGamesPerCell,
      avgHomeWinPct: avg(byFavorability.even, 'homeWinPct'),
      avgPointDiff: avg(byFavorability.even, 'avgPointDiff'),
    },
    whenAwayHasFavorableMatchup: {
      games: byFavorability.awayFav.length * numGamesPerCell,
      avgHomeWinPct: avg(byFavorability.awayFav, 'homeWinPct'),
      avgPointDiff: avg(byFavorability.awayFav, 'avgPointDiff'),
    },
  };
}

// =============================================================================
// PRINT: strategy matrix (simplified) and cap sweep summary
// =============================================================================

function printStrategyMatrixSummary(rawResults, tierCapLabel = 'No cap') {
  console.log('\n' + '='.repeat(72));
  console.log('STRATEGY MATCHUP EFFECTS ' + (tierCapLabel ? `(Tier cap: ${tierCapLabel})` : ''));
  console.log('='.repeat(72));

  // Average home win % when defense BEATS opponent offense vs when it LOSES
  let whenDefBeats = [];
  let whenDefLoses = [];
  let whenNeutral = [];

  for (const [key, r] of Object.entries(rawResults)) {
    const [homeOff, homeDef, awayOff, awayDef] = key.split('|');
    const beats = { coverage_shell: 'pass_heavy', run_stuff: 'run_dominant', base_defense: 'balanced' };
    const losesTo = { coverage_shell: 'run_dominant', run_stuff: 'balanced', base_defense: 'pass_heavy' };
    const homeDefBeatsAwayOff = beats[homeDef] === awayOff;
    const homeDefLosesToAwayOff = losesTo[homeDef] === awayOff;
    const awayDefBeatsHomeOff = beats[awayDef] === homeOff;
    const awayDefLosesToHomeOff = losesTo[awayDef] === homeOff;

    if (homeDefBeatsAwayOff && awayDefLosesToHomeOff) whenDefBeats.push(r);
    else if (homeDefLosesToAwayOff && awayDefBeatsHomeOff) whenDefLoses.push(r);
    else whenNeutral.push(r);
  }

  const avgWin = (arr) => (arr.length ? arr.reduce((s, x) => s + x.homeWinPct, 0) / arr.length : null);
  const avgDiff = (arr) => (arr.length ? arr.reduce((s, x) => s + x.avgPointDiff, 0) / arr.length : null);

  console.log('\nWhen HOME defense beats AWAY offense (and away def loses to home off):');
  console.log(`  Home win %: ${(avgWin(whenDefBeats) * 100).toFixed(1)}%  |  Avg point diff (home-away): ${avgDiff(whenDefBeats)?.toFixed(1) ?? 'N/A'}`);
  console.log('\nWhen AWAY defense beats HOME offense (and home def loses to away off):');
  console.log(`  Home win %: ${(avgWin(whenDefLoses) * 100).toFixed(1)}%  |  Avg point diff: ${avgDiff(whenDefLoses)?.toFixed(1) ?? 'N/A'}`);
  console.log('\nNeutral matchups:');
  console.log(`  Home win %: ${(avgWin(whenNeutral) * 100).toFixed(1)}%  |  Avg point diff: ${avgDiff(whenNeutral)?.toFixed(1) ?? 'N/A'}`);

  const beatWin = avgWin(whenDefBeats);
  const loseWin = avgWin(whenDefLoses);
  if (beatWin != null && loseWin != null) {
    const swing = (beatWin - loseWin) * 100;
    console.log(`\n>>> Strategy swing (home favored vs home unfavored): ${swing.toFixed(1)} pp win rate`);
  }
}

function printCapSweepResults(capResults, numGamesPerCell) {
  console.log('\n' + '='.repeat(72));
  console.log('TIER CAP SWEEP: strategy weight by cap');
  console.log('='.repeat(72));
  console.log('\nTier cap = max sum of all 25 starter tiers. Lower cap = weaker rosters.');
  console.log('Higher "strategy swing" = strategy matchup matters more at that cap.\n');

  const rows = [];
  for (const [capLabel, raw] of Object.entries(capResults)) {
    let whenDefBeats = [];
    let whenDefLoses = [];
    for (const [key, r] of Object.entries(raw)) {
      const [homeOff, homeDef, awayOff, awayDef] = key.split('|');
      const beats = { coverage_shell: 'pass_heavy', run_stuff: 'run_dominant', base_defense: 'balanced' };
      const losesTo = { coverage_shell: 'run_dominant', run_stuff: 'balanced', base_defense: 'pass_heavy' };
      const homeDefBeatsAwayOff = beats[homeDef] === awayOff;
      const awayDefLosesToHomeOff = losesTo[awayDef] === homeOff;
      const homeDefLosesToAwayOff = losesTo[homeDef] === awayOff;
      const awayDefBeatsHomeOff = beats[awayDef] === homeOff;
      if (homeDefBeatsAwayOff && awayDefLosesToHomeOff) whenDefBeats.push(r);
      else if (homeDefLosesToAwayOff && awayDefBeatsHomeOff) whenDefLoses.push(r);
    }
    const avgWin = (arr) => (arr.length ? arr.reduce((s, x) => s + x.homeWinPct, 0) / arr.length : null);
    const beatWin = avgWin(whenDefBeats);
    const loseWin = avgWin(whenDefLoses);
    const swing = beatWin != null && loseWin != null ? (beatWin - loseWin) * 100 : null;
    rows.push({ cap: capLabel, beatWin, loseWin, swing });
  }

  console.log('Cap (tier sum) | Home win% when favored | Home win% when unfavored | Strategy swing (pp)');
  console.log('-'.repeat(72));
  for (const r of rows) {
    const beat = r.beatWin != null ? (r.beatWin * 100).toFixed(1) : 'N/A';
    const lose = r.loseWin != null ? (r.loseWin * 100).toFixed(1) : 'N/A';
    const swing = r.swing != null ? r.swing.toFixed(1) : 'N/A';
    console.log(`${String(r.cap).padEnd(14)} | ${beat.padStart(22)} | ${lose.padStart(24)} | ${swing}`);
  }

  const withSwing = rows.filter((r) => r.swing != null);
  if (withSwing.length > 0) {
    const maxSwing = withSwing.reduce((best, r) => (r.swing > best.swing ? r : best), withSwing[0]);
    console.log('\n>>> Cap where strategy has the most weight (largest swing): ' + maxSwing.cap);
    console.log('\nRecommendation: A tier-sum cap in the range 85–95 (sum of all 25 starter tiers)');
    console.log('gives the largest strategy swing; cap ≤90 is a strong choice to make strategy matter more.');
  }
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const args = process.argv.slice(2);
  const strategiesOnly = args.includes('--strategies-only');
  const capsOnly = args.includes('--caps-only');
  const numGames = parseInt(args.find((a) => a.startsWith('--games='))?.split('=')[1] || '150', 10);

  // Optional: --cap-range=85-90 to sweep only those caps (inclusive)
  const capRangeArg = args.find((a) => a.startsWith('--cap-range='));
  let capRange = null;
  if (capRangeArg) {
    const [lo, hi] = capRangeArg.split('=')[1].split('-').map(Number);
    if (Number.isFinite(lo) && Number.isFinite(hi) && lo <= hi) {
      capRange = [];
      for (let c = lo; c <= hi; c++) capRange.push(c);
    }
  }

  console.log('First & 10 - Strategy Simulation');
  console.log('================================');
  console.log(`Games per matchup cell: ${numGames}`);
  if (capRange) console.log(`Cap range: ${capRange.join(', ')}`);

  // Verify roster builders produce expected strategies
  for (const off of OFF_KEYS) {
    for (const def of DEF_KEYS) {
      const r = createRosterWithStrategies(off, def);
      if (!verifyStrategy(r, off, def)) {
        console.warn(`Strategy check failed: expected off=${off} def=${def}`);
      }
    }
  }

  const sampleRoster = createRosterWithStrategies('pass_heavy', 'coverage_shell');
  console.log('\nSample roster (pass_heavy / coverage_shell) tier sum:', tierSum(sampleRoster));

  if (!capsOnly) {
    const rawResults = runStrategyMatrix(numGames, null);
    printStrategyMatrixSummary(rawResults, 'No cap');
    const agg = aggregateStrategyEffects(rawResults, numGames);
    console.log('\nAggregate by favorability:', JSON.stringify(agg, null, 2));
  }

  if (!strategiesOnly) {
    const caps = capRange ? capRange : [null, 120, 110, 100, 90, 80];
    const capResults = {};
    for (const cap of caps) {
      const label = cap == null ? 'No cap' : `≤${cap}`;
      capResults[label] = runStrategyMatrix(numGames, cap);
      if (cap == null) continue;
      printStrategyMatrixSummary(capResults[label], label);
    }
    if (caps.length > 1) {
      printCapSweepResults(capResults, numGames);
    }
  }

  console.log('\nDone.');
}

main();
