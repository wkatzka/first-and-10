/**
 * Player Trait Engine (v1)
 * =========================
 * Builds position/era percentiles from the normalized player dataset and
 * generates compact, user-friendly "engine traits" for cards.
 *
 * Design goals:
 * - Do NOT change existing cards' ownership/tier/images.
 * - Provide within-tier nuance using relative performance vs era peers.
 * - Be robust to missing stats by inferring percentiles from other stats.
 *
 * Output per card:
 *   {
 *     engine_v: 1,
 *     engine_era: "2011-2019",
 *     engine_percentiles: { ...0-100 },
 *     engine_traits: { ...0-100 },
 *     engine_inferred: { key: true }
 *   }
 */

const fs = require('fs');
const path = require('path');

const PLAYERS_PATH = path.join(__dirname, './data/normalized_players.json');

// Cache (built once per process)
let cache = null;

function normName(s) {
  return String(s || '').trim().toLowerCase();
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function clamp100(x) {
  return Math.max(0, Math.min(100, x));
}

function safeNum(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function percentileFromSorted(sorted, value) {
  if (!sorted || sorted.length === 0 || value == null) return null;
  // binary search for rightmost <= value
  let lo = 0, hi = sorted.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= value) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  if (ans < 0) return 0;
  return (ans / (sorted.length - 1 || 1)) * 100;
}

function mean(arr) {
  if (!arr || arr.length === 0) return null;
  let s = 0;
  for (const x of arr) s += x;
  return s / arr.length;
}

// Categories to merge per position group (matches how gameplay thinks about roles)
const CATEGORY_WHITELIST = {
  QB: new Set(['passing', 'rushing_receiving']),
  RB: new Set(['rushing_receiving']),
  WR: new Set(['rushing_receiving']),
  TE: new Set(['rushing_receiving']),
  OL: new Set(['defense', 'blocking']), // OL stats are sparse; accept whatever
  DL: new Set(['defense']),
  LB: new Set(['defense']),
  DB: new Set(['defense']),
  K: new Set(['kicking']),
  P: new Set(['punting']),
};

// Base stat fields we will look for (per-game rates)
const BASE_FIELDS = {
  QB: ['att_pg', 'yds_pg', 'int_pg', 'rush_yds_pg', 'rush_att_pg'],
  RB: ['rush_att_pg', 'rush_yds_pg', 'rush_td_pg', 'rec_pg', 'rec_yds_pg', 'rec_td_pg'],
  WR: ['rec_pg', 'rec_yds_pg', 'rec_td_pg'],
  TE: ['rec_pg', 'rec_yds_pg', 'rec_td_pg'],
  OL: ['tackles_pg'], // limited coverage
  DL: ['tackles_pg', 'pd_pg', 'int_pg', 'ff_pg'],
  LB: ['tackles_pg', 'pd_pg', 'int_pg', 'ff_pg'],
  DB: ['tackles_pg', 'pd_pg', 'int_pg', 'ff_pg'],
  K: ['fgm_pg', 'xpm_pg', 'scoring_fg%'],
  P: [], // dataset appears sparse here
};

// Derived metrics for percentiles/traits
function computeDerived(pos, stats) {
  const out = {};

  if (pos === 'QB') {
    const att = safeNum(stats.att_pg);
    const yds = safeNum(stats.yds_pg);
    const ints = safeNum(stats.int_pg);
    const rushYds = safeNum(stats.rush_yds_pg);

    // Proxies
    out.volume = att;
    out.mobility = rushYds;
    out.risk = ints; // lower is better; handle later
    out.efficiency = (att && yds != null) ? (yds / Math.max(1e-6, att)) : null; // yards/att proxy
  }

  if (pos === 'WR' || pos === 'TE') {
    const rec = safeNum(stats.rec_pg);
    const recYds = safeNum(stats.rec_yds_pg);
    const recTd = safeNum(stats.rec_td_pg);
    out.volume = rec;
    out.yards = recYds;
    out.td = recTd;
    out.explosiveness = (rec && recYds != null) ? (recYds / Math.max(1e-6, rec)) : null; // yds/rec
  }

  if (pos === 'RB') {
    const rushAtt = safeNum(stats.rush_att_pg);
    const rushYds = safeNum(stats.rush_yds_pg);
    const rec = safeNum(stats.rec_pg);
    const recYds = safeNum(stats.rec_yds_pg);
    out.workload = rushAtt;
    out.rush = rushYds;
    out.receiving = recYds;
    out.versatility = (rushYds != null && recYds != null) ? (rushYds + 0.6 * recYds) : null;
    out.efficiency = (rushAtt && rushYds != null) ? (rushYds / Math.max(1e-6, rushAtt)) : null; // yds/att proxy
  }

  if (pos === 'DL' || pos === 'LB' || pos === 'DB') {
    out.tackling = safeNum(stats.tackles_pg);
    out.coverage = safeNum(stats.pd_pg);
    out.ballhawk = safeNum(stats.int_pg);
    out.disruption = safeNum(stats.ff_pg);
  }

  if (pos === 'K') {
    out.fgPct = safeNum(stats['scoring_fg%']);
    out.fgMade = safeNum(stats.fgm_pg);
    out.xpMade = safeNum(stats.xpm_pg);
  }

  return out;
}

function buildCache() {
  const raw = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
  const rows = Array.isArray(raw) ? raw : [];

  // 1) Merge categories into canonical record keyed by (player, season, pos_group)
  const canonical = new Map(); // key -> { player, season, pos_group, era, stats: {}, tier?, composite_score? }
  for (const r of rows) {
    const pos = r.pos_group || r.pos || r.position;
    const player = r.player;
    const season = r.season;
    const era = r.era || null;
    const cat = r.category || null;
    if (!pos || !player || !season) continue;

    const allowed = CATEGORY_WHITELIST[pos];
    if (allowed && cat && !allowed.has(cat)) continue;

    const key = `${normName(player)}|${season}|${pos}`;
    let rec = canonical.get(key);
    if (!rec) {
      rec = {
        player,
        season,
        pos_group: pos,
        era: era || null,
        tier: r.tier,
        composite_score: r.composite_score,
        stats: {},
      };
      canonical.set(key, rec);
    }

    // Prefer era/tier if missing
    if (!rec.era && era) rec.era = era;
    if (rec.tier == null && r.tier != null) rec.tier = r.tier;
    if (rec.composite_score == null && r.composite_score != null) rec.composite_score = r.composite_score;

    // Copy over base fields if present
    const fields = BASE_FIELDS[pos] || [];
    for (const f of fields) {
      if (r[f] == null) continue;
      const v = safeNum(r[f]);
      if (v == null) continue;
      // If multiple categories provide the same stat, keep the max (usually best signal)
      if (rec.stats[f] == null || v > rec.stats[f]) rec.stats[f] = v;
    }

    // Special: fg% is stored as "scoring_fg%"
    if (pos === 'K' && r['scoring_fg%'] != null) {
      const v = safeNum(r['scoring_fg%']);
      if (v != null) rec.stats['scoring_fg%'] = v;
    }
  }

  // 2) Build distributions per (era, pos_group) for base + derived metrics
  const dist = new Map(); // key -> { base: {field: sorted[]}, derived: {metric: sorted[]} }

  function ensureDist(era, pos) {
    const key = `${era || 'unknown'}|${pos}`;
    if (!dist.has(key)) dist.set(key, { base: {}, derived: {} });
    return dist.get(key);
  }

  for (const rec of canonical.values()) {
    const eraKey = rec.era || 'unknown';
    const pos = rec.pos_group;
    const d = ensureDist(eraKey, pos);

    // base
    for (const f of (BASE_FIELDS[pos] || [])) {
      const v = safeNum(rec.stats[f]);
      if (v == null) continue;
      if (!d.base[f]) d.base[f] = [];
      d.base[f].push(v);
    }

    // derived
    const derived = computeDerived(pos, rec.stats);
    for (const [k, v] of Object.entries(derived)) {
      const n = safeNum(v);
      if (n == null) continue;
      if (!d.derived[k]) d.derived[k] = [];
      d.derived[k].push(n);
    }
  }

  // sort arrays
  for (const d of dist.values()) {
    for (const arr of Object.values(d.base)) arr.sort((a, b) => a - b);
    for (const arr of Object.values(d.derived)) arr.sort((a, b) => a - b);
  }

  return { canonical, dist };
}

function getCache() {
  if (!cache) cache = buildCache();
  return cache;
}

function inferMissingPercentile(pos, pcts) {
  // Use other present percentiles for the same position as signal.
  // (This is the “extrapolate from other strengths” approach you asked for.)
  const vals = Object.values(pcts).filter(v => typeof v === 'number' && Number.isFinite(v));
  if (vals.length === 0) return 50;
  // Slightly reward stronger overall profiles vs blanket median
  return clamp100(mean(vals));
}

function buildEngineForCard({ player_name, player, season, position, tier, composite_score } = {}) {
  const name = player_name || player;
  const pos = position;
  const yr = Number(season);
  if (!name || !pos || !Number.isFinite(yr)) return null;

  const { canonical, dist } = getCache();
  const key = `${normName(name)}|${yr}|${pos}`;
  const rec = canonical.get(key) || null;

  const era = rec?.era || 'unknown';
  const dKey = `${era}|${pos}`;
  const d = dist.get(dKey) || { base: {}, derived: {} };

  const stats = rec?.stats || {};
  const basePcts = {};
  const inferred = {};

  // Base stat percentiles (when distributions exist)
  for (const f of (BASE_FIELDS[pos] || [])) {
    const v = safeNum(stats[f]);
    const pct = percentileFromSorted(d.base[f], v);
    if (pct == null) continue;
    basePcts[f] = clamp100(pct);
  }
  // fg%
  if (pos === 'K') {
    const v = safeNum(stats['scoring_fg%']);
    const pct = percentileFromSorted(d.base['scoring_fg%'], v);
    if (pct != null) basePcts['scoring_fg%'] = clamp100(pct);
  }

  // Derived percentiles
  const derivedVals = computeDerived(pos, stats);
  const derivedPcts = {};
  for (const [k, v] of Object.entries(derivedVals)) {
    const pct = percentileFromSorted(d.derived[k], safeNum(v));
    if (pct == null) continue;
    derivedPcts[k] = clamp100(pct);
  }

  // Fill missing expected percentiles by inferring from what we DO know
  const wantKeysByPos = {
    QB: ['volume', 'efficiency', 'mobility', 'risk'],
    WR: ['volume', 'yards', 'explosiveness', 'td'],
    TE: ['volume', 'yards', 'explosiveness', 'td'],
    RB: ['workload', 'rush', 'efficiency', 'receiving', 'versatility'],
    DL: ['tackling', 'coverage', 'ballhawk', 'disruption'],
    LB: ['tackling', 'coverage', 'ballhawk', 'disruption'],
    DB: ['tackling', 'coverage', 'ballhawk', 'disruption'],
    K: ['fgPct', 'fgMade', 'xpMade'],
    OL: [],
    P: [],
  };

  const pctPack = { ...derivedPcts };
  for (const k of (wantKeysByPos[pos] || [])) {
    if (pctPack[k] == null) {
      // Fallback to strength signal from other percentiles
      const signal = inferMissingPercentile(pos, { ...basePcts, ...derivedPcts });
      pctPack[k] = signal;
      inferred[k] = true;
    }
  }

  // If we still have nothing, use tier/composite as a prior.
  if (Object.keys(pctPack).length === 0) {
    const tierPrior = tier != null ? clamp100((Number(tier) / 11) * 100) : 50;
    const compPrior = composite_score != null ? clamp100((Number(composite_score) / 100) * 100) : null;
    pctPack.overall = compPrior != null ? (0.6 * compPrior + 0.4 * tierPrior) : tierPrior;
    inferred.overall = true;
  }

  // Map percentiles -> UI-friendly engine traits (0-100)
  // New 3-element system designed for clear matchup comparisons
  const traits = {};
  if (pos === 'QB') {
    // Arm: passing accuracy/efficiency, Legs: mobility/scramble, Poise: decision-making under pressure
    traits.arm = clamp100(pctPack.efficiency ?? 50);
    traits.legs = clamp100(pctPack.mobility ?? 50);
    traits.poise = clamp100(100 - (pctPack.risk ?? 50)); // lower INTs => higher poise
  } else if (pos === 'WR') {
    // Separation: gets open, Catch: hands/contested catches, YAC: yards after catch
    traits.separation = clamp100(pctPack.volume ?? 50); // high volume = gets open often
    traits.catch = clamp100(pctPack.td ?? (pctPack.volume ?? 50)); // TD threat implies catching ability
    traits.yac = clamp100(pctPack.explosiveness ?? (pctPack.yards ?? 50)); // yards/catch = YAC potential
  } else if (pos === 'TE') {
    // Catch: receiving ability, Block: run/pass protection, YAC: after catch
    traits.catch = clamp100(pctPack.volume ?? 50);
    traits.block = clamp100(pctPack.td ?? 50); // TEs who score often are used in blocking schemes too
    traits.yac = clamp100(pctPack.explosiveness ?? (pctPack.yards ?? 50));
  } else if (pos === 'RB') {
    // Power: between tackles, Speed: outside/breakaway, Hands: receiving ability
    traits.power = clamp100(pctPack.rush ?? (pctPack.workload ?? 50));
    traits.speed = clamp100(pctPack.efficiency ?? 50); // yards/carry = breakaway ability
    traits.hands = clamp100(pctPack.receiving ?? 50);
  } else if (pos === 'OL') {
    // PassPro: protects QB, RunBlock: opens holes, Anchor: vs power rush
    // OL stats are sparse, derive from tier/composite
    const base = pctPack.overall ?? (tier != null ? clamp100((Number(tier) / 11) * 100) : 50);
    traits.passPro = clamp100(base + (Math.random() * 10 - 5)); // slight variation
    traits.runBlock = clamp100(base + (Math.random() * 10 - 5));
    traits.anchor = clamp100(base + (Math.random() * 10 - 5));
  } else if (pos === 'DL') {
    // PassRush: pressure QB, RunStuff: stop RB, Contain: edge control
    traits.passRush = clamp100(pctPack.disruption ?? 50);
    traits.runStuff = clamp100(pctPack.tackling ?? 50);
    traits.contain = clamp100(pctPack.coverage ?? 50);
  } else if (pos === 'LB') {
    // RunD: tackle RB, PassD: coverage, Blitz: rushing QB
    traits.runD = clamp100(pctPack.tackling ?? 50);
    traits.passD = clamp100(pctPack.coverage ?? 50);
    traits.blitz = clamp100(pctPack.ballhawk ?? (pctPack.disruption ?? 50)); // playmaking/disruption
  } else if (pos === 'DB') {
    // Coverage: shadow WR, BallSkills: INTs, Tackling: limit YAC
    traits.coverage = clamp100(pctPack.coverage ?? 50);
    traits.ballSkills = clamp100(pctPack.ballhawk ?? 50);
    traits.tackling = clamp100(pctPack.tackling ?? 50);
  } else if (pos === 'K') {
    // Accuracy: FG %, Range: distance, Clutch: pressure kicks
    traits.accuracy = clamp100(pctPack.fgPct ?? 50);
    traits.range = clamp100(pctPack.fgMade ?? 50);
    traits.clutch = clamp100(pctPack.xpMade ?? 50); // XP consistency as clutch proxy
  }

  // ==========================================================================
  // TIER-BASED TRAIT CEILING (Option C)
  // ==========================================================================
  // Cap traits based on player tier to maintain clear visual hierarchy:
  // Higher tiers (7-11): 10-point gaps for clear elite differentiation
  // Lower tiers (1-6): 5-point gaps
  //
  // T11 (HOF) = 100, T10 = 90, T9 = 80, T8 = 70, T7 = 60
  // T6 = 55, T5 = 50, T4 = 45, T3 = 40, T2 = 35, T1 = 30
  //
  // No floor - let traits naturally vary based on percentile data
  const playerTier = tier != null ? Math.max(1, Math.min(11, Number(tier))) : 5;
  
  const tierCaps = {
    11: 100, 10: 90, 9: 80, 8: 70, 7: 60,
    6: 55, 5: 50, 4: 45, 3: 40, 2: 35, 1: 30
  };
  const maxTraitForTier = tierCaps[playerTier] || 50;
  
  for (const key of Object.keys(traits)) {
    // Cap trait value at tier-appropriate ceiling (no floor)
    traits[key] = Math.round(Math.min(maxTraitForTier, traits[key]));
  }

  return {
    engine_v: 1,
    engine_era: era,
    engine_percentiles: pctPack,
    engine_traits: traits,
    engine_inferred: inferred,
  };
}

module.exports = {
  buildEngineForCard,
  _dangerousRebuildCacheForTests: () => { cache = null; },
};

