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
  
  return {
    name: card.player_name,
    player: card.player_name,
    season: card.season,
    team: card.team,
    position: card.position,
    tier: card.tier,
    composite_score: card.composite_score,
    stats: card.stats || {},
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
 * Auto-fill roster slots with best available cards
 */
function autoFillRoster(cards) {
  const slots = {};
  
  // Group cards by position
  const byPosition = {};
  for (const card of cards) {
    const pos = card.position;
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(card);
  }
  
  // Sort each position by tier (desc), then composite score (desc)
  for (const pos in byPosition) {
    byPosition[pos].sort((a, b) => {
      if (b.tier !== a.tier) return b.tier - a.tier;
      return (b.composite_score || 0) - (a.composite_score || 0);
    });
  }
  
  // Fill 11 slots
  const qbs = byPosition['QB'] || [];
  if (qbs[0]) slots.qb_card_id = qbs[0].id;
  
  const rbs = byPosition['RB'] || [];
  if (rbs[0]) slots.rb_card_id = rbs[0].id;
  
  const wrs = byPosition['WR'] || [];
  if (wrs[0]) slots.wr1_card_id = wrs[0].id;
  if (wrs[1]) slots.wr2_card_id = wrs[1].id;
  
  const tes = byPosition['TE'] || [];
  if (tes[0]) slots.te_card_id = tes[0].id;
  
  const ols = byPosition['OL'] || [];
  if (ols[0]) slots.ol_card_id = ols[0].id;
  
  const dls = byPosition['DL'] || [];
  if (dls[0]) slots.dl_card_id = dls[0].id;
  
  const lbs = byPosition['LB'] || [];
  if (lbs[0]) slots.lb_card_id = lbs[0].id;
  
  const dbs = byPosition['DB'] || [];
  if (dbs[0]) slots.db1_card_id = dbs[0].id;
  if (dbs[1]) slots.db2_card_id = dbs[1].id;
  
  const ks = byPosition['K'] || [];
  if (ks[0]) slots.k_card_id = ks[0].id;
  
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
