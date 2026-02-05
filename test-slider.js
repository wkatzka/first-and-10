/**
 * Test script to debug slider ratio matching
 */

// Simulate a roster with known tiers
const fakeRoster = {
  qb_card_id: { id: 1, tier: 8, position: 'QB' },
  rb_card_id: { id: 2, tier: 6, position: 'RB' },
  wr1_card_id: { id: 3, tier: 7, position: 'WR' },
  wr2_card_id: { id: 4, tier: 5, position: 'WR' },
  te_card_id: { id: 5, tier: 4, position: 'TE' },
  ol_card_id: { id: 6, tier: 5, position: 'OL' },
  dl_card_id: { id: 7, tier: 6, position: 'DL' },
  lb_card_id: { id: 8, tier: 5, position: 'LB' },
  db1_card_id: { id: 9, tier: 7, position: 'DB' },
  db2_card_id: { id: 10, tier: 6, position: 'DB' },
};

// Calculate ratio using STRATEGY ENDPOINT formula (after fix)
function calcStrategyEndpointRatio(cards) {
  const qbT = cards.qb_card_id?.tier || 5;
  const wr1T = cards.wr1_card_id?.tier || 5;
  const wr2T = cards.wr2_card_id?.tier || 5;
  const rbT = cards.rb_card_id?.tier || 5;
  const olT = cards.ol_card_id?.tier || 5;
  const passTierSum = qbT + wr1T + wr2T;
  const runTierSum = rbT + olT;
  return runTierSum > 0 ? passTierSum / runTierSum : 1.0;
}

// Calculate ratio using PRESET GENERATION formula
function calcPresetRatio(qb, rb, wr1, wr2, te, ol) {
  const passTiers = (qb?.tier || 1) + (wr1?.tier || 1) + (wr2?.tier || 1);
  const runTiers = (rb?.tier || 1) + (ol?.tier || 1);
  return passTiers / Math.max(runTiers, 1);
}

// Test
console.log('=== OFFENSE RATIO TEST ===');
console.log('Roster tiers: QB=8, RB=6, WR1=7, WR2=5, TE=4, OL=5');
console.log('');

const strategyRatio = calcStrategyEndpointRatio(fakeRoster);
console.log('Strategy endpoint ratio:', strategyRatio);
console.log('  passTierSum = 8 + 7 + 5 =', 8 + 7 + 5);
console.log('  runTierSum = 6 + 5 =', 6 + 5);
console.log('  ratio = 20 / 11 =', 20 / 11);

const presetRatio = calcPresetRatio(
  fakeRoster.qb_card_id,
  fakeRoster.rb_card_id,
  fakeRoster.wr1_card_id,
  fakeRoster.wr2_card_id,
  fakeRoster.te_card_id,
  fakeRoster.ol_card_id
);
console.log('');
console.log('Preset generation ratio:', presetRatio);
console.log('  passTiers = 8 + 7 + 5 =', 8 + 7 + 5);
console.log('  runTiers = 6 + 5 =', 6 + 5);
console.log('  ratio = 20 / 11 =', 20 / 11);

console.log('');
console.log('MATCH:', strategyRatio === presetRatio ? '✓ YES' : '✗ NO');
console.log('Difference:', Math.abs(strategyRatio - presetRatio));

// Test defense too
console.log('\n=== DEFENSE RATIO TEST ===');
console.log('Roster tiers: DL=6, LB=5, DB1=7, DB2=6');

function calcDefenseStrategyRatio(cards) {
  const db1T = cards.db1_card_id?.tier || 5;
  const db2T = cards.db2_card_id?.tier || 5;
  const dlT = cards.dl_card_id?.tier || 5;
  const lbT = cards.lb_card_id?.tier || 5;
  const coverageTiers = db1T + db2T;
  const runStuffTiers = dlT + lbT;
  return coverageTiers - runStuffTiers;
}

function calcDefensePresetRatio(dl, lb, db1, db2) {
  const coverageTiers = (db1?.tier || 1) + (db2?.tier || 1);
  const runStuffTiers = (dl?.tier || 1) + (lb?.tier || 1);
  return coverageTiers - runStuffTiers;
}

const defStrategyRatio = calcDefenseStrategyRatio(fakeRoster);
const defPresetRatio = calcDefensePresetRatio(
  fakeRoster.dl_card_id,
  fakeRoster.lb_card_id,
  fakeRoster.db1_card_id,
  fakeRoster.db2_card_id
);

console.log('Strategy endpoint ratio:', defStrategyRatio);
console.log('  coverageTiers = 7 + 6 =', 7 + 6);
console.log('  runStuffTiers = 6 + 5 =', 6 + 5);
console.log('  ratio = 13 - 11 =', 13 - 11);

console.log('');
console.log('Preset generation ratio:', defPresetRatio);
console.log('MATCH:', defStrategyRatio === defPresetRatio ? '✓ YES' : '✗ NO');
