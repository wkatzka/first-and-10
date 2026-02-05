/**
 * Game Engine Bridge
 * ===================
 * Converts database rosters to game engine format and runs simulations
 */

const path = require('path');

// Import game engine
const { simulateGame, buildRoster } = require('./game-engine/simulation');

// Tier caps (must match server/index.js)
const OFFENSE_TIER_CAP = 42; // 6 slots: QB, RB, WR1, WR2, TE, OL
const DEFENSE_TIER_CAP = 28; // 4 slots: DL, LB, DB1, DB2

/**
 * Convert database card to game engine player format
 */
function cardToPlayer(card) {
  if (!card) return null;
  
  const stats = (card.stats && typeof card.stats === 'object' && !Array.isArray(card.stats))
    ? card.stats
    : {};

  return {
    name: card.player_name,
    player: card.player_name,
    season: card.season,
    team: card.team,
    position: card.position,
    tier: card.tier,
    composite_score: card.composite_score,
    // Keep full stat object (for UI/debug), but also spread known stat keys to top-level
    // so the simulation can use season stats consistently.
    stats,
    ...stats,
    // Engine-derived traits/percentiles (era-adjusted, 0-100)
    engine_v: card.engine_v,
    engine_era: card.engine_era,
    engine_traits: card.engine_traits,
    engine_percentiles: card.engine_percentiles,
  };
}

/**
 * Convert database roster to game engine roster format
 * 11-player roster: QB, RB, WR×2, TE, OL, DL, LB, DB×2, K
 */
function dbRosterToEngineRoster(fullRoster) {
  const { roster, cards } = fullRoster;
  
  // Build the roster object that game engine expects
  const engineRoster = {
    QB: null,
    RBs: [],
    WRs: [],
    TE: null,
    OLs: [],
    DLs: [],
    LBs: [],
    DBs: [],
    K: null,
    P: null,
  };
  
  // Map 11 slots to engine positions
  if (cards.qb_card_id) engineRoster.QB = cardToPlayer(cards.qb_card_id);
  
  if (cards.rb_card_id) engineRoster.RBs.push(cardToPlayer(cards.rb_card_id));
  
  if (cards.wr1_card_id) engineRoster.WRs.push(cardToPlayer(cards.wr1_card_id));
  if (cards.wr2_card_id) engineRoster.WRs.push(cardToPlayer(cards.wr2_card_id));
  
  if (cards.te_card_id) engineRoster.TE = cardToPlayer(cards.te_card_id);
  
  if (cards.ol_card_id) engineRoster.OLs.push(cardToPlayer(cards.ol_card_id));
  
  if (cards.dl_card_id) engineRoster.DLs.push(cardToPlayer(cards.dl_card_id));
  
  if (cards.lb_card_id) engineRoster.LBs.push(cardToPlayer(cards.lb_card_id));
  
  if (cards.db1_card_id) engineRoster.DBs.push(cardToPlayer(cards.db1_card_id));
  if (cards.db2_card_id) engineRoster.DBs.push(cardToPlayer(cards.db2_card_id));
  
  if (cards.k_card_id) engineRoster.K = cardToPlayer(cards.k_card_id);
  
  // Fill in missing positions with defaults
  return fillMissingPositions(engineRoster);
}

/**
 * Fill missing positions with default tier-1 players
 */
function fillMissingPositions(roster) {
  const defaultPlayer = (position, tier = 1) => ({
    name: `Default ${position}`,
    player: `Default ${position}`,
    season: 2024,
    team: 'N/A',
    position,
    tier,
    composite_score: tier * 10,
    stats: {},
  });
  
  if (!roster.QB) roster.QB = defaultPlayer('QB');
  if (roster.RBs.length === 0) roster.RBs.push(defaultPlayer('RB'));
  if (roster.WRs.length === 0) roster.WRs.push(defaultPlayer('WR'));
  if (!roster.TE) roster.TE = defaultPlayer('TE');
  if (roster.OLs.length === 0) roster.OLs.push(defaultPlayer('OL'));
  if (roster.DLs.length === 0) roster.DLs.push(defaultPlayer('DL'));
  if (roster.LBs.length === 0) roster.LBs.push(defaultPlayer('LB'));
  if (roster.DBs.length === 0) roster.DBs.push(defaultPlayer('DB'));
  if (!roster.K) roster.K = defaultPlayer('K');
  if (!roster.P) roster.P = defaultPlayer('P');
  
  return roster;
}

/**
 * Calculate tier sums from full roster (for tier cap validation)
 * @param {object} fullRoster - { roster, cards } from db.getFullRoster
 * @returns {{ offense: number, defense: number }}
 */
function calculateTierSums(fullRoster) {
  const { cards } = fullRoster;
  if (!cards) return { offense: 0, defense: 0 };
  
  const offenseSlots = ['qb_card_id', 'rb_card_id', 'wr1_card_id', 'wr2_card_id', 'te_card_id', 'ol_card_id'];
  const defenseSlots = ['dl_card_id', 'lb_card_id', 'db1_card_id', 'db2_card_id'];
  
  let offenseSum = 0;
  for (const slot of offenseSlots) {
    const card = cards[slot];
    if (card?.tier) offenseSum += card.tier;
  }
  
  let defenseSum = 0;
  for (const slot of defenseSlots) {
    const card = cards[slot];
    if (card?.tier) defenseSum += card.tier;
  }
  
  return { offense: offenseSum, defense: defenseSum };
}

/**
 * Check if a roster is over the tier cap (offense or defense)
 * @param {object} fullRoster - { roster, cards } from db.getFullRoster
 * @returns {boolean}
 */
function isOverTierCap(fullRoster) {
  const sums = calculateTierSums(fullRoster);
  return sums.offense > OFFENSE_TIER_CAP || sums.defense > DEFENSE_TIER_CAP;
}

/**
 * Run a game simulation from database rosters
 * If a team's roster is over tier cap, their strategy defaults to balanced.
 */
function simulateGameFromDB(homeFullRoster, awayFullRoster) {
  const homeRoster = dbRosterToEngineRoster(homeFullRoster);
  const awayRoster = dbRosterToEngineRoster(awayFullRoster);
  
  // Check if either team is over tier cap (penalty: force balanced strategy)
  const homeForceBalanced = isOverTierCap(homeFullRoster);
  const awayForceBalanced = isOverTierCap(awayFullRoster);
  
  const result = simulateGame(homeRoster, awayRoster, { homeForceBalanced, awayForceBalanced });
  
  // Process plays to identify touchdowns and scoring plays
  const processedPlays = [];
  for (let i = 0; i < result.plays.length; i++) {
    const play = result.plays[i];
    const nextPlay = result.plays[i + 1];
    
    // Mark touchdown if next play is an extra point
    if (nextPlay && nextPlay.type === 'extra_point') {
      processedPlays.push({
        ...play,
        touchdown: true,
        description: play.description + ' TOUCHDOWN!',
      });
    } else {
      processedPlays.push(play);
    }
  }
  
  // Extract key plays for summary
  const keyPlays = processedPlays.filter(p => 
    p.touchdown ||
    p.type === 'field_goal' ||
    p.result === 'interception' || 
    p.result === 'fumble' ||
    p.result === 'sack' ||
    (p.yards && p.yards >= 20)
  );
  
  return {
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    winner: result.winner,
    plays: processedPlays,
    homeStats: result.homeStats,
    awayStats: result.awayStats,
    summary: {
      totalPlays: processedPlays.length,
      keyPlays: keyPlays.slice(0, 15),
      quarters: result.quarterScores || [
        { home: 0, away: 0 },
        { home: 0, away: 0 },
        { home: Math.floor(result.homeScore / 2), away: Math.floor(result.awayScore / 2) },
        { home: result.homeScore, away: result.awayScore },
      ],
    },
  };
}

/**
 * Score for default sort: tier then composite
 */
function defaultScore(card) {
  const t = card.tier || 0;
  const c = card.composite_score != null ? Number(card.composite_score) : 0;
  return t * 1000 + c;
}

/**
 * Auto-fill roster slots with best available cards, respecting tier cap.
 * @param {Array} cards - user's cards
 * @param {string} strategy - 'balanced' | 'pass_heavy' | 'run_heavy' (offense)
 * @param {string} defenseStrategy - 'coverage_shell' | 'run_stuff' | 'base_defense' (defense slot bias)
 * @param {Object|null} tierCap - { offense: number, defense: number } or null for no cap
 */
function autoFillRoster(cards, strategy = 'balanced', defenseStrategy = 'base_defense', tierCap = null) {
  const slots = {};
  const byPosition = {};
  for (const card of cards) {
    const pos = card.position;
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(card);
  }

  const trait = (card, key) => {
    const t = card.engine_traits && typeof card.engine_traits === 'object' ? card.engine_traits[key] : null;
    return typeof t === 'number' ? t : 50;
  };

  const defaultSort = (a, b) => (defaultScore(b) - defaultScore(a));

  // QB - arm (accuracy), legs (mobility), poise (decisions)
  const qbs = byPosition['QB'] || [];
  if (qbs.length) {
    if (strategy === 'pass_heavy') {
      qbs.sort((a, b) => {
        const scoreA = (trait(a, 'arm') + trait(a, 'poise')) / 2;
        const scoreB = (trait(b, 'arm') + trait(b, 'poise')) / 2;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return defaultSort(a, b);
      });
    } else if (strategy === 'run_heavy') {
      qbs.sort((a, b) => {
        const scoreA = trait(a, 'legs');
        const scoreB = trait(b, 'legs');
        if (scoreB !== scoreA) return scoreB - scoreA;
        return defaultSort(a, b);
      });
    } else {
      qbs.sort(defaultSort);
    }
    slots.qb_card_id = qbs[0].id;
  }

  // RB - power (between tackles), speed (outside/breakaway), hands (receiving)
  const rbs = byPosition['RB'] || [];
  if (rbs.length) {
    if (strategy === 'run_heavy') {
      rbs.sort((a, b) => {
        const scoreA = (trait(a, 'power') + trait(a, 'speed')) / 2;
        const scoreB = (trait(b, 'power') + trait(b, 'speed')) / 2;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return defaultSort(a, b);
      });
    } else {
      rbs.sort(defaultSort);
    }
    slots.rb_card_id = rbs[0].id;
  }

  // WRs - separation (gets open), catch (contested), yac (yards after catch)
  const wrs = byPosition['WR'] || [];
  if (wrs.length) {
    if (strategy === 'pass_heavy') {
      wrs.sort((a, b) => {
        const scoreA = (trait(a, 'separation') + trait(a, 'catch') + trait(a, 'yac')) / 3;
        const scoreB = (trait(b, 'separation') + trait(b, 'catch') + trait(b, 'yac')) / 3;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return defaultSort(a, b);
      });
    } else {
      wrs.sort(defaultSort);
    }
    if (wrs[0]) slots.wr1_card_id = wrs[0].id;
    if (wrs[1]) slots.wr2_card_id = wrs[1].id;
  }

  // TE - catch (receiving), block (protection), yac (after catch)
  const tes = byPosition['TE'] || [];
  if (tes.length) {
    if (strategy === 'pass_heavy') {
      tes.sort((a, b) => {
        const scoreA = (trait(a, 'catch') + trait(a, 'yac')) / 2;
        const scoreB = (trait(b, 'catch') + trait(b, 'yac')) / 2;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return defaultSort(a, b);
      });
    } else if (strategy === 'run_heavy') {
      // For run heavy, prioritize blocking TEs
      tes.sort((a, b) => {
        const scoreA = trait(a, 'block');
        const scoreB = trait(b, 'block');
        if (scoreB !== scoreA) return scoreB - scoreA;
        return defaultSort(a, b);
      });
    } else {
      tes.sort(defaultSort);
    }
    if (tes[0]) slots.te_card_id = tes[0].id;
  }

  // OL – always best by tier/composite
  const ols = (byPosition['OL'] || []).sort(defaultSort);
  if (ols[0]) slots.ol_card_id = ols[0].id;

  // Defense slots – bias by defenseStrategy: coverage_shell = best DBs first, run_stuff = best DL/LB first, base = best overall
  const dls = (byPosition['DL'] || []).sort(defaultSort);
  const lbs = (byPosition['LB'] || []).sort(defaultSort);
  const dbs = (byPosition['DB'] || []).sort(defaultSort);
  if (defenseStrategy === 'coverage_shell') {
    if (dbs[0]) slots.db1_card_id = dbs[0].id;
    if (dbs[1]) slots.db2_card_id = dbs[1].id;
    if (dls[0]) slots.dl_card_id = dls[0].id;
    if (lbs[0]) slots.lb_card_id = lbs[0].id;
  } else if (defenseStrategy === 'run_stuff') {
    if (dls[0]) slots.dl_card_id = dls[0].id;
    if (lbs[0]) slots.lb_card_id = lbs[0].id;
    if (dbs[0]) slots.db1_card_id = dbs[0].id;
    if (dbs[1]) slots.db2_card_id = dbs[1].id;
  } else {
    if (dls[0]) slots.dl_card_id = dls[0].id;
    if (lbs[0]) slots.lb_card_id = lbs[0].id;
    if (dbs[0]) slots.db1_card_id = dbs[0].id;
    if (dbs[1]) slots.db2_card_id = dbs[1].id;
  }

  const ks = (byPosition['K'] || []).sort(defaultSort);
  if (ks[0]) slots.k_card_id = ks[0].id;

  // If tier cap is set, check and adjust if over (separate offense and defense caps)
  if (tierCap !== null && typeof tierCap === 'object') {
    // Build a map of slot -> card for easier manipulation
    const cardMap = {};
    for (const card of cards) {
      cardMap[card.id] = card;
    }
    
    const offenseSlots = ['qb_card_id', 'rb_card_id', 'wr1_card_id', 'wr2_card_id', 'te_card_id', 'ol_card_id'];
    const defenseSlots = ['dl_card_id', 'lb_card_id', 'db1_card_id', 'db2_card_id'];
    
    // Calculate tier sums for offense and defense separately
    const getTierSums = () => {
      let offenseSum = 0;
      let defenseSum = 0;
      for (const slotId of offenseSlots) {
        const cardId = slots[slotId];
        if (cardId && cardMap[cardId]) offenseSum += cardMap[cardId].tier;
      }
      for (const slotId of defenseSlots) {
        const cardId = slots[slotId];
        if (cardId && cardMap[cardId]) defenseSum += cardMap[cardId].tier;
      }
      return { offense: offenseSum, defense: defenseSum };
    };
    
    const slotToPosition = {
      qb_card_id: 'QB', rb_card_id: 'RB', wr1_card_id: 'WR', wr2_card_id: 'WR',
      te_card_id: 'TE', ol_card_id: 'OL', dl_card_id: 'DL', lb_card_id: 'LB',
      db1_card_id: 'DB', db2_card_id: 'DB', k_card_id: 'K'
    };
    
    // Downgrade function for a specific side
    const downgradeSide = (sideSlots, cap) => {
      // Priority order for downgrading (least impactful first)
      const offenseOrder = ['ol_card_id', 'te_card_id', 'wr2_card_id', 'wr1_card_id', 'rb_card_id', 'qb_card_id'];
      const defenseOrder = ['db2_card_id', 'db1_card_id', 'lb_card_id', 'dl_card_id'];
      const downgradeOrder = sideSlots === offenseSlots ? offenseOrder : defenseOrder;
      
      const getSideSum = () => {
        let sum = 0;
        for (const slotId of sideSlots) {
          const cardId = slots[slotId];
          if (cardId && cardMap[cardId]) sum += cardMap[cardId].tier;
        }
        return sum;
      };
      
      while (getSideSum() > cap) {
        let downgraded = false;
        
        for (const slotId of downgradeOrder) {
          const currentCardId = slots[slotId];
          if (!currentCardId) continue;
          
          const currentCard = cardMap[currentCardId];
          if (!currentCard) continue;
          
          const position = slotToPosition[slotId];
          const positionCards = byPosition[position] || [];
          
          // Find a lower tier card for this position
          const lowerTierCards = positionCards
            .filter(c => c.tier < currentCard.tier && c.id !== currentCardId)
            .sort((a, b) => b.tier - a.tier); // Highest tier among lower options
          
          // For slots with 2 cards (WR, DB), check if the card is already used in the other slot
          const usedCardIds = new Set(Object.values(slots));
          const available = lowerTierCards.filter(c => !usedCardIds.has(c.id) || c.id === currentCardId);
          
          if (available.length > 0) {
            slots[slotId] = available[0].id;
            downgraded = true;
            break;
          }
        }
        
        if (!downgraded) {
          // Can't downgrade any further, remove the lowest priority card entirely
          for (const slotId of downgradeOrder) {
            if (slots[slotId]) {
              delete slots[slotId];
              break;
            }
          }
        }
      }
    };
    
    // Check and downgrade offense if over cap
    if (tierCap.offense) {
      downgradeSide(offenseSlots, tierCap.offense);
    }
    
    // Check and downgrade defense if over cap
    if (tierCap.defense) {
      downgradeSide(defenseSlots, tierCap.defense);
    }
  }

  return slots;
}

/**
 * Calculate roster power score
 */
function calculateRosterPower(fullRoster) {
  const { cards } = fullRoster;
  
  let totalTier = 0;
  let count = 0;
  
  for (const card of Object.values(cards)) {
    if (card) {
      totalTier += card.tier;
      count++;
    }
  }
  
  return {
    averageTier: count > 0 ? (totalTier / count).toFixed(1) : 0,
    filledSlots: count,
    totalSlots: 11,
    powerScore: count > 0 ? Math.round((totalTier / count) * 10) : 0,
  };
}

/**
 * Auto-fill roster to target a specific offense ratio.
 * Ratio = (QB tier + WR avg tier) / (RB tier + OL tier)
 * Higher ratio = more pass-heavy, lower = more run-heavy
 * 
 * @param {Array} cards - user's cards
 * @param {number} targetRatio - target offense ratio (0.5 to 1.5+)
 * @param {Object|null} tierCap - { offense: number, defense: number }
 * @returns {Object} slots to fill
 */
function autoFillToOffenseRatio(cards, targetRatio = 1.0, tierCap = null) {
  const byPosition = {};
  for (const card of cards) {
    const pos = card.position;
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(card);
  }
  
  // Sort all positions by tier (descending)
  for (const pos of Object.keys(byPosition)) {
    byPosition[pos].sort((a, b) => (b.tier || 0) - (a.tier || 0));
  }
  
  const slots = {};
  const usedIds = new Set();
  
  // Helper to pick best available card for a position
  const pickBest = (position) => {
    const available = (byPosition[position] || []).filter(c => !usedIds.has(c.id));
    if (available.length === 0) return null;
    usedIds.add(available[0].id);
    return available[0];
  };
  
  // Helper to pick card at specific tier index for a position
  const pickAtTierRank = (position, rank) => {
    const available = (byPosition[position] || []).filter(c => !usedIds.has(c.id));
    if (available.length === 0) return null;
    const idx = Math.min(rank, available.length - 1);
    usedIds.add(available[idx].id);
    return available[idx];
  };
  
  // Calculate what ratio we'd get with all best cards
  const qbs = byPosition['QB'] || [];
  const rbs = byPosition['RB'] || [];
  const wrs = byPosition['WR'] || [];
  const ols = byPosition['OL'] || [];
  
  // Determine bias based on target ratio
  // targetRatio > 1.0 means pass-heavy: prioritize high-tier QB/WR
  // targetRatio < 1.0 means run-heavy: prioritize high-tier RB/OL
  const passBias = targetRatio > 1.0;
  const runBias = targetRatio < 1.0;
  
  // For pass-heavy: pick best QB/WR, then fill RB/OL to achieve ratio
  // For run-heavy: pick best RB/OL, then fill QB/WR to achieve ratio
  // For balanced: pick best everywhere
  
  if (passBias) {
    // Prioritize pass positions with best tiers
    if (qbs.length) { slots.qb_card_id = qbs[0].id; usedIds.add(qbs[0].id); }
    const wrAvail = wrs.filter(c => !usedIds.has(c.id));
    if (wrAvail.length >= 1) { slots.wr1_card_id = wrAvail[0].id; usedIds.add(wrAvail[0].id); }
    if (wrAvail.length >= 2) { slots.wr2_card_id = wrAvail[1].id; usedIds.add(wrAvail[1].id); }
    
    // Now fill run positions - pick lower-tier to increase ratio
    // The more extreme the target, the lower tier we pick
    const runRank = Math.min(Math.floor((targetRatio - 1.0) * 3), 2); // 0, 1, or 2
    const rbCard = pickAtTierRank('RB', runRank);
    if (rbCard) slots.rb_card_id = rbCard.id;
    const olCard = pickAtTierRank('OL', runRank);
    if (olCard) slots.ol_card_id = olCard.id;
  } else if (runBias) {
    // Prioritize run positions with best tiers
    if (rbs.length) { slots.rb_card_id = rbs[0].id; usedIds.add(rbs[0].id); }
    if (ols.length) { slots.ol_card_id = ols[0].id; usedIds.add(ols[0].id); }
    
    // Fill pass positions with lower tier to decrease ratio
    const passRank = Math.min(Math.floor((1.0 - targetRatio) * 3), 2); // 0, 1, or 2
    const qbCard = pickAtTierRank('QB', passRank);
    if (qbCard) slots.qb_card_id = qbCard.id;
    const wrAvail = (byPosition['WR'] || []).filter(c => !usedIds.has(c.id));
    if (wrAvail.length >= 1) { 
      const wr1 = wrAvail[Math.min(passRank, wrAvail.length - 1)];
      slots.wr1_card_id = wr1.id; 
      usedIds.add(wr1.id); 
    }
    const wrAvail2 = (byPosition['WR'] || []).filter(c => !usedIds.has(c.id));
    if (wrAvail2.length >= 1) { 
      const wr2 = wrAvail2[Math.min(passRank, wrAvail2.length - 1)];
      slots.wr2_card_id = wr2.id; 
      usedIds.add(wr2.id); 
    }
  } else {
    // Balanced - pick best everywhere
    const qb = pickBest('QB'); if (qb) slots.qb_card_id = qb.id;
    const rb = pickBest('RB'); if (rb) slots.rb_card_id = rb.id;
    const wr1 = pickBest('WR'); if (wr1) slots.wr1_card_id = wr1.id;
    const wr2 = pickBest('WR'); if (wr2) slots.wr2_card_id = wr2.id;
    const ol = pickBest('OL'); if (ol) slots.ol_card_id = ol.id;
  }
  
  // Fill remaining offense positions
  if (!slots.qb_card_id) { const c = pickBest('QB'); if (c) slots.qb_card_id = c.id; }
  if (!slots.rb_card_id) { const c = pickBest('RB'); if (c) slots.rb_card_id = c.id; }
  if (!slots.wr1_card_id) { const c = pickBest('WR'); if (c) slots.wr1_card_id = c.id; }
  if (!slots.wr2_card_id) { const c = pickBest('WR'); if (c) slots.wr2_card_id = c.id; }
  if (!slots.ol_card_id) { const c = pickBest('OL'); if (c) slots.ol_card_id = c.id; }
  
  // Fill TE (neutral position)
  const te = pickBest('TE'); if (te) slots.te_card_id = te.id;
  
  // Fill defense with best available (ratio doesn't affect defense)
  const dl = pickBest('DL'); if (dl) slots.dl_card_id = dl.id;
  const lb = pickBest('LB'); if (lb) slots.lb_card_id = lb.id;
  const db1 = pickBest('DB'); if (db1) slots.db1_card_id = db1.id;
  const db2 = pickBest('DB'); if (db2) slots.db2_card_id = db2.id;
  
  // Fill K
  const k = pickBest('K'); if (k) slots.k_card_id = k.id;
  
  // Apply tier cap if needed (reuse existing logic)
  if (tierCap) {
    const cardMap = {};
    for (const card of cards) cardMap[card.id] = card;
    
    const offenseSlots = ['qb_card_id', 'rb_card_id', 'wr1_card_id', 'wr2_card_id', 'te_card_id', 'ol_card_id'];
    const defenseSlots = ['dl_card_id', 'lb_card_id', 'db1_card_id', 'db2_card_id'];
    
    const getSideSum = (sideSlots) => {
      let sum = 0;
      for (const slotId of sideSlots) {
        const cardId = slots[slotId];
        if (cardId && cardMap[cardId]) sum += cardMap[cardId].tier;
      }
      return sum;
    };
    
    // Simple cap enforcement: if over, swap down
    while (tierCap.offense && getSideSum(offenseSlots) > tierCap.offense) {
      let swapped = false;
      for (const slotId of offenseSlots) {
        const cardId = slots[slotId];
        if (!cardId) continue;
        const current = cardMap[cardId];
        if (!current) continue;
        const pos = slotId.replace('_card_id', '').replace(/[12]/, '').toUpperCase();
        const lower = (byPosition[pos] || []).find(c => c.tier < current.tier && !Object.values(slots).includes(c.id));
        if (lower) {
          slots[slotId] = lower.id;
          swapped = true;
          break;
        }
      }
      if (!swapped) break;
    }
  }
  
  return slots;
}

/**
 * Auto-fill roster to target a specific defense ratio.
 * Ratio = DB tier - ((DL tier + LB tier) / 2)
 * Positive = coverage-heavy, negative = run-stuff-heavy
 * 
 * @param {Array} cards - user's cards
 * @param {number} targetRatio - target defense ratio (-3 to +3)
 * @param {Object|null} tierCap - { offense: number, defense: number }
 * @returns {Object} defense slots only
 */
function autoFillToDefenseRatio(cards, targetRatio = 0, tierCap = null) {
  const byPosition = {};
  for (const card of cards) {
    const pos = card.position;
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(card);
  }
  
  for (const pos of Object.keys(byPosition)) {
    byPosition[pos].sort((a, b) => (b.tier || 0) - (a.tier || 0));
  }
  
  const slots = {};
  const usedIds = new Set();
  
  const pickBest = (position) => {
    const available = (byPosition[position] || []).filter(c => !usedIds.has(c.id));
    if (available.length === 0) return null;
    usedIds.add(available[0].id);
    return available[0];
  };
  
  const pickAtTierRank = (position, rank) => {
    const available = (byPosition[position] || []).filter(c => !usedIds.has(c.id));
    if (available.length === 0) return null;
    const idx = Math.min(rank, available.length - 1);
    usedIds.add(available[idx].id);
    return available[idx];
  };
  
  const coverageBias = targetRatio > 0;
  const runStuffBias = targetRatio < 0;
  
  if (coverageBias) {
    // Prioritize DBs
    const db1 = pickBest('DB'); if (db1) slots.db1_card_id = db1.id;
    const db2 = pickBest('DB'); if (db2) slots.db2_card_id = db2.id;
    // Lower tier for DL/LB
    const rank = Math.min(Math.floor(targetRatio), 2);
    const dl = pickAtTierRank('DL', rank); if (dl) slots.dl_card_id = dl.id;
    const lb = pickAtTierRank('LB', rank); if (lb) slots.lb_card_id = lb.id;
  } else if (runStuffBias) {
    // Prioritize DL/LB
    const dl = pickBest('DL'); if (dl) slots.dl_card_id = dl.id;
    const lb = pickBest('LB'); if (lb) slots.lb_card_id = lb.id;
    // Lower tier for DBs
    const rank = Math.min(Math.floor(-targetRatio), 2);
    const db1 = pickAtTierRank('DB', rank); if (db1) slots.db1_card_id = db1.id;
    const db2 = pickAtTierRank('DB', rank); if (db2) slots.db2_card_id = db2.id;
  } else {
    // Balanced
    const dl = pickBest('DL'); if (dl) slots.dl_card_id = dl.id;
    const lb = pickBest('LB'); if (lb) slots.lb_card_id = lb.id;
    const db1 = pickBest('DB'); if (db1) slots.db1_card_id = db1.id;
    const db2 = pickBest('DB'); if (db2) slots.db2_card_id = db2.id;
  }
  
  // Fill any missing
  if (!slots.dl_card_id) { const c = pickBest('DL'); if (c) slots.dl_card_id = c.id; }
  if (!slots.lb_card_id) { const c = pickBest('LB'); if (c) slots.lb_card_id = c.id; }
  if (!slots.db1_card_id) { const c = pickBest('DB'); if (c) slots.db1_card_id = c.id; }
  if (!slots.db2_card_id) { const c = pickBest('DB'); if (c) slots.db2_card_id = c.id; }
  
  return slots;
}

/**
 * Generate all unique roster presets for offense.
 * Returns distinct configurations sorted by their strategic ratio.
 * Each preset is the best achievable roster for that point on the spectrum.
 */
function generateOffensePresets(cards, tierCap = null) {
  const byPosition = {};
  for (const card of cards) {
    const pos = card.position;
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(card);
  }
  
  // Sort all positions by tier descending
  for (const pos of Object.keys(byPosition)) {
    byPosition[pos].sort((a, b) => (b.tier || 0) - (a.tier || 0));
  }
  
  const qbs = byPosition['QB'] || [];
  const rbs = byPosition['RB'] || [];
  const wrs = byPosition['WR'] || [];
  const tes = byPosition['TE'] || [];
  const ols = byPosition['OL'] || [];
  
  // If user lacks cards for any position, return empty
  if (qbs.length === 0 || rbs.length === 0 || wrs.length < 2 || tes.length === 0 || ols.length === 0) {
    return [];
  }
  
  const presets = [];
  const seenConfigs = new Set();
  
  // Helper to calculate ratio for a config
  const calcRatio = (qb, rb, wr1, wr2, te, ol) => {
    const passTiers = (qb?.tier || 1) + (wr1?.tier || 1) + (wr2?.tier || 1);
    const runTiers = (rb?.tier || 1) + (ol?.tier || 1);
    return passTiers / Math.max(runTiers, 1);
  };
  
  // Helper to calculate tier sum
  const calcTierSum = (qb, rb, wr1, wr2, te, ol) => {
    return (qb?.tier || 0) + (rb?.tier || 0) + (wr1?.tier || 0) + (wr2?.tier || 0) + (te?.tier || 0) + (ol?.tier || 0);
  };
  
  // Generate configurations by trying different tier combinations
  // Try top 3 cards from each position to generate diversity
  const maxDepth = 3;
  
  for (let qi = 0; qi < Math.min(maxDepth, qbs.length); qi++) {
    for (let ri = 0; ri < Math.min(maxDepth, rbs.length); ri++) {
      for (let wi1 = 0; wi1 < Math.min(maxDepth, wrs.length - 1); wi1++) {
        for (let wi2 = wi1 + 1; wi2 < Math.min(maxDepth + 1, wrs.length); wi2++) {
          for (let ti = 0; ti < Math.min(maxDepth, tes.length); ti++) {
            for (let oi = 0; oi < Math.min(maxDepth, ols.length); oi++) {
              const qb = qbs[qi];
              const rb = rbs[ri];
              const wr1 = wrs[wi1];
              const wr2 = wrs[wi2];
              const te = tes[ti];
              const ol = ols[oi];
              
              // Check tier cap
              const tierSum = calcTierSum(qb, rb, wr1, wr2, te, ol);
              if (tierCap?.offense && tierSum > tierCap.offense) continue;
              
              // Create unique key for this config
              const configKey = [qb.id, rb.id, wr1.id, wr2.id, te.id, ol.id].sort().join('-');
              if (seenConfigs.has(configKey)) continue;
              seenConfigs.add(configKey);
              
              const ratio = calcRatio(qb, rb, wr1, wr2, te, ol);
              
              presets.push({
                slots: {
                  qb_card_id: qb.id,
                  rb_card_id: rb.id,
                  wr1_card_id: wr1.id,
                  wr2_card_id: wr2.id,
                  te_card_id: te.id,
                  ol_card_id: ol.id,
                },
                ratio,
                tierSum,
                cards: { qb, rb, wr1, wr2, te, ol },
              });
            }
          }
        }
      }
    }
  }
  
  // Sort by ratio and dedupe similar ratios (keep best tier sum for each ratio band)
  presets.sort((a, b) => a.ratio - b.ratio);
  
  // Bin presets into ~7 ratio bands and keep best (highest tier sum under cap) for each
  const numBands = 7;
  if (presets.length === 0) return [];
  
  const minRatio = presets[0].ratio;
  const maxRatio = presets[presets.length - 1].ratio;
  const bandSize = (maxRatio - minRatio) / numBands || 0.1;
  
  const bands = {};
  for (const preset of presets) {
    const band = Math.floor((preset.ratio - minRatio) / bandSize);
    const key = Math.min(band, numBands - 1);
    if (!bands[key] || preset.tierSum > bands[key].tierSum) {
      bands[key] = preset;
    }
  }
  
  // Get unique presets from bands
  const result = Object.values(bands);
  result.sort((a, b) => a.ratio - b.ratio);
  
  // Label them
  return result.map((p, i) => ({
    ...p,
    label: i === 0 ? 'Run Heavy' : i === result.length - 1 ? 'Pass Heavy' : 
           i === Math.floor(result.length / 2) ? 'Balanced' : '',
    strategy: p.ratio < 0.9 ? 'run_heavy' : p.ratio > 1.3 ? 'pass_heavy' : 'balanced',
  }));
}

/**
 * Generate all unique roster presets for defense.
 * Returns distinct configurations sorted by their strategic ratio.
 */
function generateDefensePresets(cards, tierCap = null) {
  const byPosition = {};
  for (const card of cards) {
    const pos = card.position;
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(card);
  }
  
  // Sort all positions by tier descending
  for (const pos of Object.keys(byPosition)) {
    byPosition[pos].sort((a, b) => (b.tier || 0) - (a.tier || 0));
  }
  
  const dls = byPosition['DL'] || [];
  const lbs = byPosition['LB'] || [];
  const dbs = byPosition['DB'] || [];
  
  // If user lacks cards for any position, return empty
  if (dls.length === 0 || lbs.length === 0 || dbs.length < 2) {
    return [];
  }
  
  const presets = [];
  const seenConfigs = new Set();
  
  // Helper to calculate ratio for a config
  // Positive = coverage-heavy (high DB tiers), Negative = run-stuff (high DL/LB tiers)
  const calcRatio = (dl, lb, db1, db2) => {
    const coverageTiers = (db1?.tier || 1) + (db2?.tier || 1);
    const runStuffTiers = (dl?.tier || 1) + (lb?.tier || 1);
    return coverageTiers - runStuffTiers;
  };
  
  // Helper to calculate tier sum
  const calcTierSum = (dl, lb, db1, db2) => {
    return (dl?.tier || 0) + (lb?.tier || 0) + (db1?.tier || 0) + (db2?.tier || 0);
  };
  
  // Generate configurations by trying different tier combinations
  const maxDepth = 4;
  
  for (let di = 0; di < Math.min(maxDepth, dls.length); di++) {
    for (let li = 0; li < Math.min(maxDepth, lbs.length); li++) {
      for (let bi1 = 0; bi1 < Math.min(maxDepth, dbs.length - 1); bi1++) {
        for (let bi2 = bi1 + 1; bi2 < Math.min(maxDepth + 1, dbs.length); bi2++) {
          const dl = dls[di];
          const lb = lbs[li];
          const db1 = dbs[bi1];
          const db2 = dbs[bi2];
          
          // Check tier cap
          const tierSum = calcTierSum(dl, lb, db1, db2);
          if (tierCap?.defense && tierSum > tierCap.defense) continue;
          
          // Create unique key for this config
          const configKey = [dl.id, lb.id, db1.id, db2.id].sort().join('-');
          if (seenConfigs.has(configKey)) continue;
          seenConfigs.add(configKey);
          
          const ratio = calcRatio(dl, lb, db1, db2);
          
          presets.push({
            slots: {
              dl_card_id: dl.id,
              lb_card_id: lb.id,
              db1_card_id: db1.id,
              db2_card_id: db2.id,
            },
            ratio,
            tierSum,
            cards: { dl, lb, db1, db2 },
          });
        }
      }
    }
  }
  
  // Sort by ratio
  presets.sort((a, b) => a.ratio - b.ratio);
  
  // Bin presets into ~5 ratio bands and keep best for each
  const numBands = 5;
  if (presets.length === 0) return [];
  
  const minRatio = presets[0].ratio;
  const maxRatio = presets[presets.length - 1].ratio;
  const bandSize = (maxRatio - minRatio) / numBands || 0.5;
  
  const bands = {};
  for (const preset of presets) {
    const band = Math.floor((preset.ratio - minRatio) / bandSize);
    const key = Math.min(band, numBands - 1);
    if (!bands[key] || preset.tierSum > bands[key].tierSum) {
      bands[key] = preset;
    }
  }
  
  const result = Object.values(bands);
  result.sort((a, b) => a.ratio - b.ratio);
  
  // Label them
  return result.map((p, i) => ({
    ...p,
    label: i === 0 ? 'Run Stuff' : i === result.length - 1 ? 'Coverage' : 
           i === Math.floor(result.length / 2) ? 'Base' : '',
    strategy: p.ratio < -2 ? 'run_stuff' : p.ratio > 2 ? 'coverage_shell' : 'base_defense',
  }));
}

module.exports = {
  cardToPlayer,
  dbRosterToEngineRoster,
  fillMissingPositions,
  simulateGameFromDB,
  autoFillRoster,
  autoFillToOffenseRatio,
  autoFillToDefenseRatio,
  calculateRosterPower,
  generateOffensePresets,
  generateDefensePresets,
};
