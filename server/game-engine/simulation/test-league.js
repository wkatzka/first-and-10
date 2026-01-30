#!/usr/bin/env node
/**
 * League System Test
 * ===================
 * Tests the division and league functionality.
 */

const {
  createTestRoster,
  calculatePowerScore,
  getDivision,
  getDivisionInfo,
  createLeague,
  addTeamToLeague,
  generateLeagueSchedule,
  simulateSeason,
  getLeagueStandings,
  processPromotionRelegation,
  formatStandings,
  formatPowerBreakdown,
  DIVISIONS,
} = require('./index');

// =============================================================================
// TEST: POWER SCORE CALCULATION
// =============================================================================

function testPowerScores() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Power Score Calculation by Tier');
  console.log('='.repeat(60));
  
  const testCases = [
    { name: 'All T10 (Legendary)', tiers: { QB: 10, RB: 10, WR: 10, TE: 10, OL: 10, DL: 10, LB: 10, DB: 10, K: 10, P: 10 } },
    { name: 'All T8 (Ultra Rare)', tiers: { QB: 8, RB: 8, WR: 8, TE: 8, OL: 8, DL: 8, LB: 8, DB: 8, K: 8, P: 8 } },
    { name: 'All T5 (Uncommon+)', tiers: { QB: 5, RB: 5, WR: 5, TE: 5, OL: 5, DL: 5, LB: 5, DB: 5, K: 5, P: 5 } },
    { name: 'All T3 (Common+)', tiers: { QB: 3, RB: 3, WR: 3, TE: 3, OL: 3, DL: 3, LB: 3, DB: 3, K: 3, P: 3 } },
    { name: 'All T1 (Basic)', tiers: { QB: 1, RB: 1, WR: 1, TE: 1, OL: 1, DL: 1, LB: 1, DB: 1, K: 1, P: 1 } },
    { name: 'Mixed (QB T10, rest T5)', tiers: { QB: 10, RB: 5, WR: 5, TE: 5, OL: 5, DL: 5, LB: 5, DB: 5, K: 5, P: 5 } },
    { name: 'Offense Heavy (Off T8, Def T4)', tiers: { QB: 8, RB: 8, WR: 8, TE: 8, OL: 8, DL: 4, LB: 4, DB: 4, K: 5, P: 5 } },
    { name: 'Defense Heavy (Off T4, Def T8)', tiers: { QB: 4, RB: 4, WR: 4, TE: 4, OL: 4, DL: 8, LB: 8, DB: 8, K: 5, P: 5 } },
  ];
  
  console.log(`\n${'Team Type'.padEnd(35)} ${'Power'.padStart(8)} ${'Division'.padEnd(15)}`);
  console.log('-'.repeat(60));
  
  for (const { name, tiers } of testCases) {
    const roster = createTestRoster(tiers);
    const { powerScore } = calculatePowerScore(roster);
    const division = getDivisionInfo(powerScore);
    
    console.log(`${name.padEnd(35)} ${powerScore.toFixed(1).padStart(8)} ${division.name.padEnd(15)}`);
  }
}

// =============================================================================
// TEST: DIVISION BOUNDARIES
// =============================================================================

function testDivisionBoundaries() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Division Boundaries');
  console.log('='.repeat(60));
  
  console.log('\nDivision Thresholds:');
  for (const [key, config] of Object.entries(DIVISIONS)) {
    console.log(`  ${config.name}: ${config.minPower} - ${config.maxPower === Infinity ? '∞' : config.maxPower}`);
  }
  
  // Test boundary cases
  console.log('\nBoundary Tests:');
  const boundaryTests = [84.9, 85, 85.1, 69.9, 70, 70.1, 54.9, 55, 55.1, 39.9, 40, 40.1];
  
  for (const score of boundaryTests) {
    const div = getDivisionInfo(score);
    console.log(`  Power ${score}: ${div.name}`);
  }
}

// =============================================================================
// TEST: FULL LEAGUE SIMULATION
// =============================================================================

function testLeagueSimulation() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Full League Simulation');
  console.log('='.repeat(60));
  
  // Create teams with varying power levels
  const teams = [
    // Legendary Division
    { name: 'Dynasty Kings', roster: createTestRoster({ QB: 10, RB: 10, WR: 10, TE: 9, OL: 9, DL: 10, LB: 9, DB: 10, K: 8, P: 7 }) },
    { name: 'Elite Empire', roster: createTestRoster({ QB: 10, RB: 9, WR: 10, TE: 10, OL: 8, DL: 9, LB: 10, DB: 9, K: 9, P: 8 }) },
    { name: 'Champion Force', roster: createTestRoster({ QB: 9, RB: 10, WR: 9, TE: 9, OL: 9, DL: 10, LB: 9, DB: 10, K: 7, P: 6 }) },
    
    // Elite Division
    { name: 'Rising Stars', roster: createTestRoster({ QB: 8, RB: 8, WR: 8, TE: 7, OL: 7, DL: 8, LB: 8, DB: 8, K: 6, P: 6 }) },
    { name: 'Contenders FC', roster: createTestRoster({ QB: 8, RB: 7, WR: 8, TE: 8, OL: 8, DL: 7, LB: 8, DB: 7, K: 7, P: 7 }) },
    { name: 'Power Surge', roster: createTestRoster({ QB: 7, RB: 8, WR: 8, TE: 7, OL: 8, DL: 8, LB: 7, DB: 8, K: 6, P: 5 }) },
    
    // Pro Division
    { name: 'Steady Grind', roster: createTestRoster({ QB: 6, RB: 6, WR: 7, TE: 6, OL: 6, DL: 6, LB: 6, DB: 6, K: 5, P: 5 }) },
    { name: 'Middle Ground', roster: createTestRoster({ QB: 6, RB: 7, WR: 6, TE: 6, OL: 7, DL: 6, LB: 7, DB: 6, K: 6, P: 6 }) },
    { name: 'The Hopefuls', roster: createTestRoster({ QB: 7, RB: 6, WR: 6, TE: 5, OL: 6, DL: 7, LB: 6, DB: 7, K: 5, P: 4 }) },
    
    // Amateur Division
    { name: 'Rookie Squad', roster: createTestRoster({ QB: 5, RB: 5, WR: 5, TE: 4, OL: 4, DL: 5, LB: 5, DB: 5, K: 4, P: 4 }) },
    { name: 'New Beginnings', roster: createTestRoster({ QB: 4, RB: 5, WR: 5, TE: 5, OL: 5, DL: 4, LB: 4, DB: 5, K: 5, P: 5 }) },
    { name: 'Underdog FC', roster: createTestRoster({ QB: 5, RB: 4, WR: 4, TE: 4, OL: 5, DL: 5, LB: 5, DB: 4, K: 4, P: 3 }) },
    
    // Rookie Division
    { name: 'Fresh Start', roster: createTestRoster({ QB: 3, RB: 3, WR: 3, TE: 3, OL: 3, DL: 3, LB: 3, DB: 3, K: 3, P: 3 }) },
    { name: 'The Learners', roster: createTestRoster({ QB: 2, RB: 3, WR: 3, TE: 2, OL: 3, DL: 2, LB: 3, DB: 2, K: 2, P: 2 }) },
    { name: 'Day One FC', roster: createTestRoster({ QB: 2, RB: 2, WR: 2, TE: 2, OL: 2, DL: 2, LB: 2, DB: 2, K: 2, P: 2 }) },
  ];
  
  // Create league
  console.log('\nCreating league with', teams.length, 'teams...');
  const league = createLeague('First & 10 League', teams);
  
  // Show initial division placement
  console.log('\n--- Initial Division Placement ---');
  for (const [divKey, divTeams] of Object.entries(league.divisions)) {
    if (divTeams.length === 0) continue;
    console.log(`\n${DIVISIONS[divKey].name} Division:`);
    for (const team of divTeams) {
      console.log(`  ${team.name} (Power: ${team.powerScore})`);
    }
  }
  
  // Generate schedule
  console.log('\nGenerating schedule (2 games per matchup)...');
  generateLeagueSchedule(league, 2);
  console.log(`Total games scheduled: ${league.schedule.length}`);
  console.log(`Weeks in season: ${league.weeks.length}`);
  
  // Simulate the season
  console.log('\nSimulating season...');
  const seasonResults = simulateSeason(league);
  
  // Show final standings
  console.log('\n' + formatStandings(league));
  
  // Process promotion/relegation
  console.log('\n--- Promotion/Relegation ---');
  const changes = processPromotionRelegation(league, 1, 1); // 1 up, 1 down
  
  if (changes.length === 0) {
    console.log('No changes (not enough teams in divisions)');
  } else {
    for (const change of changes) {
      const arrow = change.type === 'promoted' ? '↑' : '↓';
      console.log(`${arrow} ${change.team}: ${change.from} → ${change.to} (${change.type})`);
    }
  }
  
  return league;
}

// =============================================================================
// TEST: POWER BREAKDOWN
// =============================================================================

function testPowerBreakdown() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: Power Score Breakdown');
  console.log('='.repeat(60));
  
  const roster = createTestRoster({ 
    QB: 10, 
    RB: 8, 
    WR: 9, 
    TE: 7, 
    OL: 6, 
    DL: 8, 
    LB: 7, 
    DB: 8, 
    K: 5, 
    P: 4 
  });
  
  console.log('\n' + formatPowerBreakdown(roster));
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  console.log('First & 10 - League System Test');
  console.log('===================================');
  
  testPowerScores();
  testDivisionBoundaries();
  testPowerBreakdown();
  testLeagueSimulation();
  
  console.log('\n✓ League tests complete!');
}

main();
