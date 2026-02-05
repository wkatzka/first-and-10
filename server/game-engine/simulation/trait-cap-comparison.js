/**
 * Trait Cap Comparison Simulation
 * ================================
 * Compares three trait ceiling options to see impact on differentiation.
 */

const fs = require('fs');
const path = require('path');

// Load player data
const dataPath = path.join(__dirname, '../data/normalized_players.json');
const players = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Get unique players
const seen = new Set();
const uniquePlayers = players.filter(p => {
  const key = `${p.player}|${p.season}|${p.pos_group}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return p.tier != null;
});

// =============================================================================
// TRAIT CAP OPTIONS
// =============================================================================

function getCap_Current(tier) {
  // Current: 5 per tier
  // T11=100, T10=95, T9=90, T8=85, T7=80, T6=75, T5=70, T4=65, T3=60, T2=55, T1=50
  return 45 + (tier * 5);
}

function getCap_OptionB(tier) {
  // Option B: 10 until T7, then 5
  // T11=100, T10=95, T9=85, T8=75, T7=65, T6=60, T5=55, T4=50, T3=45, T2=40, T1=35
  if (tier >= 10) return 95 + (tier - 10) * 5;  // T10=95, T11=100
  if (tier >= 7) return 65 + (tier - 7) * 10;   // T7=65, T8=75, T9=85
  return 35 + (tier * 5);                        // T1=40, T2=45... T6=65
}

function getCap_OptionC(tier) {
  // Option C: T11=100, T10=90, T9=80, T8=70, T7=60, then drop 5
  // T11=100, T10=90, T9=80, T8=70, T7=60, T6=55, T5=50, T4=45, T3=40, T2=35, T1=30
  if (tier >= 7) return 60 + (tier - 7) * 10;   // T7=60, T8=70, T9=80, T10=90, T11=100
  return 30 + (tier - 1) * 5;                    // T1=30, T2=35, T3=40, T4=45, T5=50, T6=55
}

// =============================================================================
// DISPLAY CAP TABLES
// =============================================================================

console.log('='.repeat(70));
console.log('TRAIT CAP OPTIONS COMPARISON');
console.log('='.repeat(70));
console.log();
console.log('Tier | Current | Option B | Option C');
console.log('-----|---------|----------|----------');
for (let t = 11; t >= 1; t--) {
  console.log(`T${t.toString().padStart(2)}  |   ${getCap_Current(t).toString().padStart(3)}   |    ${getCap_OptionB(t).toString().padStart(3)}   |    ${getCap_OptionC(t).toString().padStart(3)}`);
}

// =============================================================================
// ANALYZE TRAIT IMPACT
// =============================================================================

// Mock trait generator that returns raw percentiles (before capping)
// We'll simulate what happens when caps are applied

function getRawTraits() {
  // Simulate raw percentile traits (0-100, roughly normal distribution around 50)
  const traits = [];
  for (let i = 0; i < 3; i++) {
    // Use normal-ish distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const val = Math.max(0, Math.min(100, 50 + z * 20));
    traits.push(val);
  }
  return traits;
}

function applyCapToTraits(rawTraits, cap) {
  return rawTraits.map(t => Math.min(cap, t));
}

// =============================================================================
// SIMULATION
// =============================================================================

console.log();
console.log('='.repeat(70));
console.log('SIMULATION: How caps affect trait ranges');
console.log('='.repeat(70));
console.log('Running 1000 simulated players per tier...');
console.log();

const results = {};
const numSamples = 1000;

for (let tier = 1; tier <= 11; tier++) {
  const capCurrent = getCap_Current(tier);
  const capB = getCap_OptionB(tier);
  const capC = getCap_OptionC(tier);
  
  let sumCurrent = 0, sumB = 0, sumC = 0;
  let maxCurrent = 0, maxB = 0, maxC = 0;
  let cappedCurrent = 0, cappedB = 0, cappedC = 0;
  
  for (let i = 0; i < numSamples; i++) {
    const raw = getRawTraits();
    
    const capped_current = applyCapToTraits(raw, capCurrent);
    const capped_b = applyCapToTraits(raw, capB);
    const capped_c = applyCapToTraits(raw, capC);
    
    sumCurrent += capped_current.reduce((a,b) => a+b, 0) / 3;
    sumB += capped_b.reduce((a,b) => a+b, 0) / 3;
    sumC += capped_c.reduce((a,b) => a+b, 0) / 3;
    
    maxCurrent = Math.max(maxCurrent, ...capped_current);
    maxB = Math.max(maxB, ...capped_b);
    maxC = Math.max(maxC, ...capped_c);
    
    // Count how many traits got capped
    for (let j = 0; j < 3; j++) {
      if (raw[j] >= capCurrent) cappedCurrent++;
      if (raw[j] >= capB) cappedB++;
      if (raw[j] >= capC) cappedC++;
    }
  }
  
  results[tier] = {
    avgCurrent: (sumCurrent / numSamples).toFixed(1),
    avgB: (sumB / numSamples).toFixed(1),
    avgC: (sumC / numSamples).toFixed(1),
    cappedPctCurrent: ((cappedCurrent / (numSamples * 3)) * 100).toFixed(1),
    cappedPctB: ((cappedB / (numSamples * 3)) * 100).toFixed(1),
    cappedPctC: ((cappedC / (numSamples * 3)) * 100).toFixed(1),
  };
}

console.log('AVERAGE TRAIT VALUE BY TIER');
console.log('---------------------------');
console.log('Tier | Current | Option B | Option C');
console.log('-----|---------|----------|----------');
for (let t = 11; t >= 1; t--) {
  const r = results[t];
  console.log(`T${t.toString().padStart(2)}  |   ${r.avgCurrent.padStart(4)}  |   ${r.avgB.padStart(4)}   |   ${r.avgC.padStart(4)}`);
}

console.log();
console.log('% OF TRAITS HITTING CEILING');
console.log('---------------------------');
console.log('Tier | Current | Option B | Option C');
console.log('-----|---------|----------|----------');
for (let t = 11; t >= 1; t--) {
  const r = results[t];
  console.log(`T${t.toString().padStart(2)}  |   ${r.cappedPctCurrent.padStart(4)}%  |   ${r.cappedPctB.padStart(4)}%  |   ${r.cappedPctC.padStart(4)}%`);
}

// =============================================================================
// KEY DIFFERENTIATION TEST
// =============================================================================

console.log();
console.log('='.repeat(70));
console.log('KEY QUESTION: Can you tell tiers apart by looking at traits?');
console.log('='.repeat(70));
console.log();
console.log('Gap between adjacent tier averages:');
console.log('-----------------------------------');
console.log('Tiers    | Current | Option B | Option C');
console.log('---------|---------|----------|----------');
for (let t = 11; t >= 2; t--) {
  const higher = results[t];
  const lower = results[t-1];
  const gapCurrent = (parseFloat(higher.avgCurrent) - parseFloat(lower.avgCurrent)).toFixed(1);
  const gapB = (parseFloat(higher.avgB) - parseFloat(lower.avgB)).toFixed(1);
  const gapC = (parseFloat(higher.avgC) - parseFloat(lower.avgC)).toFixed(1);
  console.log(`T${t.toString().padStart(2)}→T${(t-1).toString().padStart(2)} |   ${gapCurrent.padStart(4)}  |   ${gapB.padStart(4)}   |   ${gapC.padStart(4)}`);
}

console.log();
console.log('SUMMARY');
console.log('-------');
const t10_t8_current = (parseFloat(results[10].avgCurrent) - parseFloat(results[8].avgCurrent)).toFixed(1);
const t10_t8_b = (parseFloat(results[10].avgB) - parseFloat(results[8].avgB)).toFixed(1);
const t10_t8_c = (parseFloat(results[10].avgC) - parseFloat(results[8].avgC)).toFixed(1);
console.log(`T10 vs T8 gap: Current=${t10_t8_current}, OptionB=${t10_t8_b}, OptionC=${t10_t8_c}`);

const t8_t5_current = (parseFloat(results[8].avgCurrent) - parseFloat(results[5].avgCurrent)).toFixed(1);
const t8_t5_b = (parseFloat(results[8].avgB) - parseFloat(results[5].avgB)).toFixed(1);
const t8_t5_c = (parseFloat(results[8].avgC) - parseFloat(results[5].avgC)).toFixed(1);
console.log(`T8 vs T5 gap:  Current=${t8_t5_current}, OptionB=${t8_t5_b}, OptionC=${t8_t5_c}`);
