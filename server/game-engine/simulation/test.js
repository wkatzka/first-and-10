#!/usr/bin/env node
/**
 * Game Engine Test Script
 * ========================
 * Tests the simulation with real player data.
 * 
 * Usage:
 *   node test.js                    # Run default tests
 *   node test.js --matchup          # T10 vs T1 matchup test
 *   node test.js --players          # Use real player data
 *   node test.js --verbose          # Show play-by-play
 *   node test.js --games 100        # Run multiple games
 */

const fs = require('fs');
const path = require('path');
const {
  simulateGame,
  createTestRoster,
  buildRoster,
  getTeamSummary,
  formatGameResult,
  formatPlayByPlay,
  calculateTeamRatings,
} = require('./index');

// =============================================================================
// LOAD PLAYER DATA
// =============================================================================

function loadPlayerData() {
  const dataPath = path.join(__dirname, '../data/normalized_players.json');
  
  if (!fs.existsSync(dataPath)) {
    console.log('Player data not found at:', dataPath);
    console.log('Run normalize_stats.py first to generate player data.');
    return null;
  }
  
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`Loaded ${data.length.toLocaleString()} player cards`);
  return data;
}

/**
 * Find players by criteria
 */
function findPlayers(data, criteria) {
  return data.filter(p => {
    for (const [key, value] of Object.entries(criteria)) {
      if (Array.isArray(value)) {
        if (!value.includes(p[key])) return false;
      } else if (p[key] !== value) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Get top N players by position and tier
 */
function getTopPlayers(data, posGroup, tier, limit = 10) {
  return data
    .filter(p => p.pos_group === posGroup && p.tier === tier)
    .sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0))
    .slice(0, limit);
}

/**
 * Build a dream team from real player data
 */
function buildDreamTeam(data, tier = 10) {
  const roster = {
    QB: getTopPlayers(data, 'QB', tier, 1)[0],
    RBs: getTopPlayers(data, 'RB', tier, 2),
    WRs: getTopPlayers(data, 'WR', tier, 3),
    TE: getTopPlayers(data, 'TE', tier, 1)[0],
    OLs: getTopPlayers(data, 'OL', tier, 5).length >= 5 
      ? getTopPlayers(data, 'OL', tier, 5)
      : [...getTopPlayers(data, 'OL', tier, 5), ...getTopPlayers(data, 'OL', tier - 1, 5)].slice(0, 5),
    DLs: getTopPlayers(data, 'DL', tier, 4),
    LBs: getTopPlayers(data, 'LB', tier, 3),
    DBs: getTopPlayers(data, 'DB', tier, 4),
    K: getTopPlayers(data, 'K', tier, 1)[0] || getTopPlayers(data, 'K', tier - 1, 1)[0],
    P: getTopPlayers(data, 'P', tier, 1)[0] || getTopPlayers(data, 'P', tier - 1, 1)[0],
  };
  
  // Fill gaps with lower tier if needed
  if (!roster.QB) roster.QB = getTopPlayers(data, 'QB', tier - 1, 1)[0];
  if (roster.RBs.length < 2) roster.RBs = [...roster.RBs, ...getTopPlayers(data, 'RB', tier - 1, 2)].slice(0, 2);
  if (roster.WRs.length < 3) roster.WRs = [...roster.WRs, ...getTopPlayers(data, 'WR', tier - 1, 3)].slice(0, 3);
  if (!roster.TE) roster.TE = getTopPlayers(data, 'TE', tier - 1, 1)[0];
  if (roster.DLs.length < 4) roster.DLs = [...roster.DLs, ...getTopPlayers(data, 'DL', tier - 1, 4)].slice(0, 4);
  if (roster.LBs.length < 3) roster.LBs = [...roster.LBs, ...getTopPlayers(data, 'LB', tier - 1, 3)].slice(0, 3);
  if (roster.DBs.length < 4) roster.DBs = [...roster.DBs, ...getTopPlayers(data, 'DB', tier - 1, 4)].slice(0, 4);
  
  return roster;
}

// =============================================================================
// TESTS
// =============================================================================

/**
 * Test: Tier 10 vs Tier 1 matchup
 */
function testTierMatchup(numGames = 100) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Tier 10 (All Legendary) vs Tier 1 (All Basic)');
  console.log('='.repeat(60));
  
  const t10Roster = createTestRoster({ QB: 10, RB: 10, WR: 10, TE: 10, OL: 10, DL: 10, LB: 10, DB: 10, K: 10, P: 10 });
  const t1Roster = createTestRoster({ QB: 1, RB: 1, WR: 1, TE: 1, OL: 1, DL: 1, LB: 1, DB: 1, K: 1, P: 1 });
  
  console.log('\nT10 Team:', getTeamSummary(t10Roster));
  console.log('T1 Team:', getTeamSummary(t1Roster));
  
  let t10Wins = 0, t1Wins = 0, ties = 0;
  let totalT10Score = 0, totalT1Score = 0;
  
  console.log(`\nSimulating ${numGames} games...`);
  
  for (let i = 0; i < numGames; i++) {
    const result = simulateGame(t10Roster, t1Roster);
    
    if (result.winner === 'home') t10Wins++;
    else if (result.winner === 'away') t1Wins++;
    else ties++;
    
    totalT10Score += result.homeScore;
    totalT1Score += result.awayScore;
  }
  
  console.log('\nRESULTS:');
  console.log(`T10 Wins: ${t10Wins} (${(t10Wins/numGames*100).toFixed(1)}%)`);
  console.log(`T1 Wins: ${t1Wins} (${(t1Wins/numGames*100).toFixed(1)}%)`);
  console.log(`Ties: ${ties}`);
  console.log(`Avg Score - T10: ${(totalT10Score/numGames).toFixed(1)}, T1: ${(totalT1Score/numGames).toFixed(1)}`);
  
  return { t10Wins, t1Wins, ties };
}

/**
 * Test: Balanced matchup (T5 vs T5)
 */
function testBalancedMatchup(numGames = 100) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Tier 5 vs Tier 5 (Balanced Matchup)');
  console.log('='.repeat(60));
  
  const roster1 = createTestRoster({ QB: 5, RB: 5, WR: 5, TE: 5, OL: 5, DL: 5, LB: 5, DB: 5, K: 5, P: 5 });
  const roster2 = createTestRoster({ QB: 5, RB: 5, WR: 5, TE: 5, OL: 5, DL: 5, LB: 5, DB: 5, K: 5, P: 5 });
  
  let homeWins = 0, awayWins = 0, ties = 0;
  let totalHomeScore = 0, totalAwayScore = 0;
  
  console.log(`Simulating ${numGames} games...`);
  
  for (let i = 0; i < numGames; i++) {
    const result = simulateGame(roster1, roster2);
    
    if (result.winner === 'home') homeWins++;
    else if (result.winner === 'away') awayWins++;
    else ties++;
    
    totalHomeScore += result.homeScore;
    totalAwayScore += result.awayScore;
  }
  
  console.log('\nRESULTS:');
  console.log(`Home Wins: ${homeWins} (${(homeWins/numGames*100).toFixed(1)}%)`);
  console.log(`Away Wins: ${awayWins} (${(awayWins/numGames*100).toFixed(1)}%)`);
  console.log(`Ties: ${ties}`);
  console.log(`Avg Score - Home: ${(totalHomeScore/numGames).toFixed(1)}, Away: ${(totalAwayScore/numGames).toFixed(1)}`);
}

/**
 * Test: QB + WR Synergy
 */
function testQBWRSynergy(numGames = 100) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: QB + WR Synergy Effect');
  console.log('='.repeat(60));
  
  // Elite QB with elite WRs
  const eliteCombo = createTestRoster({ QB: 10, RB: 5, WR: 10, TE: 5, OL: 5, DL: 5, LB: 5, DB: 5, K: 5, P: 5 });
  // Elite QB with bad WRs
  const badWRs = createTestRoster({ QB: 10, RB: 5, WR: 2, TE: 5, OL: 5, DL: 5, LB: 5, DB: 5, K: 5, P: 5 });
  
  console.log('\nElite QB + Elite WRs:', getTeamSummary(eliteCombo));
  console.log('Elite QB + Bad WRs:', getTeamSummary(badWRs));
  
  let eliteWins = 0;
  let totalEliteScore = 0, totalBadScore = 0;
  
  console.log(`\nSimulating ${numGames} games...`);
  
  for (let i = 0; i < numGames; i++) {
    const result = simulateGame(eliteCombo, badWRs);
    if (result.winner === 'home') eliteWins++;
    totalEliteScore += result.homeScore;
    totalBadScore += result.awayScore;
  }
  
  console.log('\nRESULTS:');
  console.log(`Elite QB + Elite WRs wins: ${eliteWins}/${numGames} (${(eliteWins/numGames*100).toFixed(1)}%)`);
  console.log(`Avg Score - Elite Combo: ${(totalEliteScore/numGames).toFixed(1)}, Bad WRs: ${(totalBadScore/numGames).toFixed(1)}`);
  console.log('This shows WR synergy effect - same QB performs better with good WRs');
}

/**
 * Test with real player data
 */
function testWithRealPlayers(verbose = false) {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Real Player Dream Teams');
  console.log('='.repeat(60));
  
  const data = loadPlayerData();
  if (!data) return;
  
  // Build T10 dream team
  console.log('\nBuilding Tier 10 Dream Team...');
  const dreamTeam = buildDreamTeam(data, 10);
  
  // Build T5 average team
  console.log('Building Tier 5 Average Team...');
  const avgTeam = buildDreamTeam(data, 5);
  
  console.log('\n--- DREAM TEAM (T10) ---');
  console.log(`QB: ${dreamTeam.QB?.player} (${dreamTeam.QB?.season}) - Tier ${dreamTeam.QB?.tier}`);
  console.log(`RBs: ${dreamTeam.RBs.map(p => `${p.player} (${p.season})`).join(', ')}`);
  console.log(`WRs: ${dreamTeam.WRs.map(p => `${p.player} (${p.season})`).join(', ')}`);
  console.log(`TE: ${dreamTeam.TE?.player} (${dreamTeam.TE?.season})`);
  console.log('Ratings:', getTeamSummary(dreamTeam));
  
  console.log('\n--- AVERAGE TEAM (T5) ---');
  console.log(`QB: ${avgTeam.QB?.player} (${avgTeam.QB?.season}) - Tier ${avgTeam.QB?.tier}`);
  console.log('Ratings:', getTeamSummary(avgTeam));
  
  // Simulate
  console.log('\nSimulating game...');
  const result = simulateGame(dreamTeam, avgTeam, { verbose });
  
  console.log('\n' + formatGameResult(result));
  
  if (verbose) {
    console.log('\n' + formatPlayByPlay(result, 30));
  }
  
  return result;
}

/**
 * Run single game with verbose output
 */
function runSingleGame() {
  console.log('\n' + '='.repeat(60));
  console.log('SINGLE GAME - FULL PLAY-BY-PLAY');
  console.log('='.repeat(60));
  
  const home = createTestRoster({ QB: 8, RB: 7, WR: 8, TE: 6, OL: 6, DL: 6, LB: 7, DB: 7, K: 6, P: 5 });
  const away = createTestRoster({ QB: 6, RB: 8, WR: 6, TE: 7, OL: 7, DL: 7, LB: 6, DB: 6, K: 7, P: 6 });
  
  console.log('\nHome Team:', getTeamSummary(home));
  console.log('Away Team:', getTeamSummary(away));
  
  const result = simulateGame(home, away, { verbose: true });
  
  console.log('\n' + formatGameResult(result));
  console.log('\n' + formatPlayByPlay(result, 50));
  
  return result;
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const args = process.argv.slice(2);
  
  const verbose = args.includes('--verbose') || args.includes('-v');
  const numGames = parseInt(args.find(a => a.startsWith('--games='))?.split('=')[1] || '100');
  
  console.log('First & 10 - Simulation Engine Test');
  console.log('======================================');
  
  if (args.includes('--matchup')) {
    testTierMatchup(numGames);
  } else if (args.includes('--balanced')) {
    testBalancedMatchup(numGames);
  } else if (args.includes('--synergy')) {
    testQBWRSynergy(numGames);
  } else if (args.includes('--players')) {
    testWithRealPlayers(verbose);
  } else if (args.includes('--single')) {
    runSingleGame();
  } else {
    // Run all tests
    testTierMatchup(50);
    testBalancedMatchup(50);
    testQBWRSynergy(50);
    testWithRealPlayers(false);
  }
  
  console.log('\n✓ Tests complete!');
}

main();
