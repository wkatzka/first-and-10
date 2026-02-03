/**
 * Tier balance calibration
 * ------------------------
 * Runs quick Monte Carlo sims to validate:
 * - clear separation across tiers
 * - meaningful variance within tiers
 *
 * Usage:
 *   node server/game-engine/simulation/calibrate-tier-balance.js
 */

const { simulateGame } = require('./index');

function mkPlayer(pos, tier, score01to100) {
  // Use engine_traits as a clean 0-100 driver for within-tier variance.
  // For calibration, we set every trait to the same value.
  const traitsByPos = {
    QB: ['accuracy', 'riskControl', 'mobility', 'volume'],
    RB: ['powerRun', 'breakaway', 'workhorse', 'receiving'],
    WR: ['hands', 'explosive', 'tdThreat'],
    TE: ['hands', 'explosive', 'tdThreat'],
    OL: [],
    DL: ['pressure', 'runStop', 'coverage'],
    LB: ['runStop', 'coverage', 'playmaking'],
    DB: ['coverage', 'ballhawk', 'tackling'],
    K: ['accuracy', 'range', 'extraPoints'],
    P: [],
  };

  const keys = traitsByPos[pos] || [];
  const engine_traits = {};
  for (const k of keys) engine_traits[k] = score01to100;

  return {
    player: `Test ${pos}`,
    pos_group: pos,
    tier,
    composite_score: score01to100,
    engine_traits,
    stats: {},
  };
}

function mkRoster({ baseTier = 5, qbTier = baseTier, qbScore = 50, oppTier = baseTier, oppScore = 50 } = {}) {
  // Baseline roster all at baseTier, neutral trait score 50.
  const t = baseTier;
  const s = 50;
  return {
    QB: mkPlayer('QB', qbTier, qbScore),
    RBs: [mkPlayer('RB', t, s), mkPlayer('RB', t, s)],
    WRs: [mkPlayer('WR', t, s), mkPlayer('WR', t, s), mkPlayer('WR', t, s)],
    TE: mkPlayer('TE', t, s),
    OLs: [mkPlayer('OL', t, s), mkPlayer('OL', t, s), mkPlayer('OL', t, s), mkPlayer('OL', t, s), mkPlayer('OL', t, s)],
    DLs: [mkPlayer('DL', t, s), mkPlayer('DL', t, s), mkPlayer('DL', t, s), mkPlayer('DL', t, s)],
    LBs: [mkPlayer('LB', t, s), mkPlayer('LB', t, s), mkPlayer('LB', t, s)],
    DBs: [mkPlayer('DB', t, s), mkPlayer('DB', t, s), mkPlayer('DB', t, s), mkPlayer('DB', t, s)],
    K: mkPlayer('K', t, s),
    P: mkPlayer('P', t, s),
  };
}

function runMatchup({ label, makeHome, makeAway, games = 5000 } = {}) {
  let homeWins = 0;
  let awayWins = 0;
  let ties = 0;

  for (let i = 0; i < games; i++) {
    const res = simulateGame(makeHome(), makeAway());
    if (res.homeScore > res.awayScore) homeWins++;
    else if (res.awayScore > res.homeScore) awayWins++;
    else ties++;
  }

  const hw = (homeWins / games * 100).toFixed(1);
  const aw = (awayWins / games * 100).toFixed(1);
  const tw = (ties / games * 100).toFixed(1);

  console.log(`${label}: home ${hw}% | away ${aw}% | tie ${tw}%  (n=${games})`);
}

function main() {
  console.log('--- Tier calibration (within-tier variance enabled) ---');
  console.log('Goal checks:');
  console.log('- Best of tier below should be competitive but disadvantaged vs worst of tier above.');
  console.log('- Within-tier extremes should feel different but not erase tier gaps.\n');

  // Adjacent tier boundary check: worst T6 vs best T5 at QB
  runMatchup({
    label: 'QB boundary: worst T6 vs best T5 (everything else equal)',
    makeHome: () => mkRoster({ baseTier: 5, qbTier: 6, qbScore: 0 }),
    makeAway: () => mkRoster({ baseTier: 5, qbTier: 5, qbScore: 100 }),
  });

  // Within-tier spread check: best vs worst within same tier
  runMatchup({
    label: 'QB within-tier: best T6 vs worst T6 (everything else equal)',
    makeHome: () => mkRoster({ baseTier: 5, qbTier: 6, qbScore: 100 }),
    makeAway: () => mkRoster({ baseTier: 5, qbTier: 6, qbScore: 0 }),
  });

  // Tier-only check: neutral scores, tier advantage
  runMatchup({
    label: 'QB tier-only: neutral T6 vs neutral T5 (everything else equal)',
    makeHome: () => mkRoster({ baseTier: 5, qbTier: 6, qbScore: 50 }),
    makeAway: () => mkRoster({ baseTier: 5, qbTier: 5, qbScore: 50 }),
  });
}

main();

