/**
 * Game Engine Bridge
 * ===================
 * Converts database rosters to game engine format and runs simulations
 */

const path = require('path');

// Import game engine
const { simulateGame, buildRoster } = require('./game-engine/simulation');

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
 * Run a game simulation from database rosters
 */
function simulateGameFromDB(homeFullRoster, awayFullRoster) {
  const homeRoster = dbRosterToEngineRoster(homeFullRoster);
  const awayRoster = dbRosterToEngineRoster(awayFullRoster);
  
  const result = simulateGame(homeRoster, awayRoster);
  
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

module.exports = {
  cardToPlayer,
  dbRosterToEngineRoster,
  fillMissingPositions,
  simulateGameFromDB,
  autoFillRoster,
  calculateRosterPower,
};
