/**
 * League & Division System
 * =========================
 * Organizes teams into divisions based on roster power scores.
 * Supports seasons, standings, promotion/relegation.
 */

const { simulateGame } = require('./game');
const { calculateTeamRatings, avgTier } = require('./playstyle');

// =============================================================================
// DIVISION CONFIGURATION
// =============================================================================

const DIVISIONS = {
  LEGENDARY: {
    name: 'Legendary',
    minPower: 85,
    maxPower: Infinity,
    color: '#FFD700', // Gold
    description: 'Elite teams with top-tier rosters',
  },
  ELITE: {
    name: 'Elite',
    minPower: 70,
    maxPower: 84.99,
    color: '#9B59B6', // Purple
    description: 'Strong teams with mostly rare+ players',
  },
  PRO: {
    name: 'Pro',
    minPower: 55,
    maxPower: 69.99,
    color: '#3498DB', // Blue
    description: 'Competitive teams with balanced rosters',
  },
  AMATEUR: {
    name: 'Amateur',
    minPower: 40,
    maxPower: 54.99,
    color: '#2ECC71', // Green
    description: 'Growing teams building their roster',
  },
  ROOKIE: {
    name: 'Rookie',
    minPower: 0,
    maxPower: 39.99,
    color: '#95A5A6', // Gray
    description: 'New teams with starter rosters',
  },
};

// Position weights for power score calculation
const POWER_WEIGHTS = {
  QB: 2.0,    // QB is most important
  RB: 1.3,    // RBs matter
  WR: 1.3,    // WRs matter
  TE: 1.0,    // TE is solid
  OL: 0.8,    // OL helps but less flashy
  DL: 1.1,    // Pass rush matters
  LB: 1.0,    // LBs are balanced
  DB: 1.1,    // Coverage matters
  K: 0.5,     // Kickers are low impact
  P: 0.3,     // Punters even lower
};

// =============================================================================
// POWER SCORE CALCULATION
// =============================================================================

/**
 * Calculate team power score (determines division placement)
 * @param {object} roster - Team roster
 * @returns {object} - { powerScore, breakdown }
 */
function calculatePowerScore(roster) {
  const breakdown = {};
  let totalScore = 0;
  let totalWeight = 0;
  
  // QB
  if (roster.QB) {
    const score = (roster.QB.tier || 5) * POWER_WEIGHTS.QB;
    breakdown.QB = { tier: roster.QB.tier, weight: POWER_WEIGHTS.QB, score };
    totalScore += score;
    totalWeight += POWER_WEIGHTS.QB;
  }
  
  // RBs
  if (roster.RBs && roster.RBs.length > 0) {
    const avg = avgTier(roster.RBs);
    const weight = POWER_WEIGHTS.RB * Math.min(roster.RBs.length, 2); // Max 2 RBs count
    const score = avg * weight;
    breakdown.RB = { avgTier: avg, count: roster.RBs.length, weight, score };
    totalScore += score;
    totalWeight += weight;
  }
  
  // WRs
  if (roster.WRs && roster.WRs.length > 0) {
    const avg = avgTier(roster.WRs);
    const weight = POWER_WEIGHTS.WR * Math.min(roster.WRs.length, 3); // Max 3 WRs count
    const score = avg * weight;
    breakdown.WR = { avgTier: avg, count: roster.WRs.length, weight, score };
    totalScore += score;
    totalWeight += weight;
  }
  
  // TE
  if (roster.TE) {
    const score = (roster.TE.tier || 5) * POWER_WEIGHTS.TE;
    breakdown.TE = { tier: roster.TE.tier, weight: POWER_WEIGHTS.TE, score };
    totalScore += score;
    totalWeight += POWER_WEIGHTS.TE;
  }
  
  // OLs
  if (roster.OLs && roster.OLs.length > 0) {
    const avg = avgTier(roster.OLs);
    const weight = POWER_WEIGHTS.OL * Math.min(roster.OLs.length, 5);
    const score = avg * weight;
    breakdown.OL = { avgTier: avg, count: roster.OLs.length, weight, score };
    totalScore += score;
    totalWeight += weight;
  }
  
  // DLs
  if (roster.DLs && roster.DLs.length > 0) {
    const avg = avgTier(roster.DLs);
    const weight = POWER_WEIGHTS.DL * Math.min(roster.DLs.length, 4);
    const score = avg * weight;
    breakdown.DL = { avgTier: avg, count: roster.DLs.length, weight, score };
    totalScore += score;
    totalWeight += weight;
  }
  
  // LBs
  if (roster.LBs && roster.LBs.length > 0) {
    const avg = avgTier(roster.LBs);
    const weight = POWER_WEIGHTS.LB * Math.min(roster.LBs.length, 3);
    const score = avg * weight;
    breakdown.LB = { avgTier: avg, count: roster.LBs.length, weight, score };
    totalScore += score;
    totalWeight += weight;
  }
  
  // DBs
  if (roster.DBs && roster.DBs.length > 0) {
    const avg = avgTier(roster.DBs);
    const weight = POWER_WEIGHTS.DB * Math.min(roster.DBs.length, 4);
    const score = avg * weight;
    breakdown.DB = { avgTier: avg, count: roster.DBs.length, weight, score };
    totalScore += score;
    totalWeight += weight;
  }
  
  // K
  if (roster.K) {
    const score = (roster.K.tier || 5) * POWER_WEIGHTS.K;
    breakdown.K = { tier: roster.K.tier, weight: POWER_WEIGHTS.K, score };
    totalScore += score;
    totalWeight += POWER_WEIGHTS.K;
  }
  
  // P
  if (roster.P) {
    const score = (roster.P.tier || 5) * POWER_WEIGHTS.P;
    breakdown.P = { tier: roster.P.tier, weight: POWER_WEIGHTS.P, score };
    totalScore += score;
    totalWeight += POWER_WEIGHTS.P;
  }
  
  // Normalize to 0-100 scale (max possible is ~10 * totalWeight)
  const maxPossible = 10 * totalWeight;
  const normalizedScore = (totalScore / maxPossible) * 100;
  
  return {
    powerScore: Math.round(normalizedScore * 10) / 10,
    rawScore: totalScore,
    totalWeight,
    breakdown,
  };
}

/**
 * Determine division for a power score
 * @param {number} powerScore 
 * @returns {string} - Division key
 */
function getDivision(powerScore) {
  for (const [key, config] of Object.entries(DIVISIONS)) {
    if (powerScore >= config.minPower && powerScore <= config.maxPower) {
      return key;
    }
  }
  return 'ROOKIE';
}

/**
 * Get division info
 */
function getDivisionInfo(powerScore) {
  const divisionKey = getDivision(powerScore);
  return {
    key: divisionKey,
    ...DIVISIONS[divisionKey],
  };
}

// =============================================================================
// LEAGUE MANAGEMENT
// =============================================================================

/**
 * Create a new league
 */
function createLeague(name, teams = []) {
  const league = {
    name,
    teams: [],
    divisions: {
      LEGENDARY: [],
      ELITE: [],
      PRO: [],
      AMATEUR: [],
      ROOKIE: [],
    },
    season: 1,
    week: 0,
    schedule: [],
    standings: {},
  };
  
  // Add teams
  for (const team of teams) {
    addTeamToLeague(league, team);
  }
  
  return league;
}

/**
 * Add a team to the league
 */
function addTeamToLeague(league, team) {
  const { powerScore } = calculatePowerScore(team.roster);
  const division = getDivision(powerScore);
  
  const teamEntry = {
    id: team.id || `team_${league.teams.length + 1}`,
    name: team.name || `Team ${league.teams.length + 1}`,
    owner: team.owner,
    roster: team.roster,
    powerScore,
    division,
    stats: {
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: 0,
    },
  };
  
  league.teams.push(teamEntry);
  league.divisions[division].push(teamEntry);
  league.standings[teamEntry.id] = teamEntry.stats;
  
  return teamEntry;
}

/**
 * Generate a round-robin schedule for a division
 */
function generateDivisionSchedule(teams, gamesPerMatchup = 2) {
  const schedule = [];
  
  if (teams.length < 2) return schedule;
  
  // Round-robin: each team plays every other team
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      for (let g = 0; g < gamesPerMatchup; g++) {
        // Alternate home/away
        if (g % 2 === 0) {
          schedule.push({ home: teams[i].id, away: teams[j].id });
        } else {
          schedule.push({ home: teams[j].id, away: teams[i].id });
        }
      }
    }
  }
  
  // Shuffle schedule
  for (let i = schedule.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [schedule[i], schedule[j]] = [schedule[j], schedule[i]];
  }
  
  return schedule;
}

/**
 * Generate full league schedule (all divisions)
 */
function generateLeagueSchedule(league, gamesPerMatchup = 2) {
  league.schedule = [];
  
  for (const [divisionKey, teams] of Object.entries(league.divisions)) {
    if (teams.length >= 2) {
      const divisionSchedule = generateDivisionSchedule(teams, gamesPerMatchup);
      for (const game of divisionSchedule) {
        league.schedule.push({
          ...game,
          division: divisionKey,
          played: false,
          result: null,
        });
      }
    }
  }
  
  // Organize into weeks
  const gamesPerWeek = Math.floor(league.teams.length / 2);
  league.weeks = [];
  let weekGames = [];
  const teamsPlayingThisWeek = new Set();
  
  for (const game of league.schedule) {
    if (!teamsPlayingThisWeek.has(game.home) && !teamsPlayingThisWeek.has(game.away)) {
      weekGames.push(game);
      teamsPlayingThisWeek.add(game.home);
      teamsPlayingThisWeek.add(game.away);
      
      if (weekGames.length >= gamesPerWeek) {
        league.weeks.push([...weekGames]);
        weekGames = [];
        teamsPlayingThisWeek.clear();
      }
    }
  }
  
  // Add remaining games
  if (weekGames.length > 0) {
    league.weeks.push(weekGames);
  }
  
  return league.schedule;
}

/**
 * Simulate a single game in the league
 */
function simulateLeagueGame(league, game) {
  const homeTeam = league.teams.find(t => t.id === game.home);
  const awayTeam = league.teams.find(t => t.id === game.away);
  
  if (!homeTeam || !awayTeam) {
    throw new Error(`Teams not found: ${game.home}, ${game.away}`);
  }
  
  const result = simulateGame(homeTeam.roster, awayTeam.roster);
  
  // Update game record
  game.played = true;
  game.result = {
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    winner: result.winner,
  };
  
  // Update standings
  homeTeam.stats.pointsFor += result.homeScore;
  homeTeam.stats.pointsAgainst += result.awayScore;
  awayTeam.stats.pointsFor += result.awayScore;
  awayTeam.stats.pointsAgainst += result.homeScore;
  
  if (result.winner === 'home') {
    homeTeam.stats.wins++;
    awayTeam.stats.losses++;
    homeTeam.stats.streak = homeTeam.stats.streak >= 0 ? homeTeam.stats.streak + 1 : 1;
    awayTeam.stats.streak = awayTeam.stats.streak <= 0 ? awayTeam.stats.streak - 1 : -1;
  } else if (result.winner === 'away') {
    awayTeam.stats.wins++;
    homeTeam.stats.losses++;
    awayTeam.stats.streak = awayTeam.stats.streak >= 0 ? awayTeam.stats.streak + 1 : 1;
    homeTeam.stats.streak = homeTeam.stats.streak <= 0 ? homeTeam.stats.streak - 1 : -1;
  } else {
    homeTeam.stats.ties++;
    awayTeam.stats.ties++;
  }
  
  return {
    ...result,
    home: homeTeam.name,
    away: awayTeam.name,
  };
}

/**
 * Simulate a full week of games
 */
function simulateWeek(league, weekNumber) {
  const week = league.weeks[weekNumber - 1];
  if (!week) {
    throw new Error(`Week ${weekNumber} not found`);
  }
  
  const results = [];
  
  for (const game of week) {
    if (!game.played) {
      const result = simulateLeagueGame(league, game);
      results.push(result);
    }
  }
  
  league.week = weekNumber;
  
  return results;
}

/**
 * Simulate entire season
 */
function simulateSeason(league) {
  const allResults = [];
  
  for (let week = 1; week <= league.weeks.length; week++) {
    const weekResults = simulateWeek(league, week);
    allResults.push({ week, results: weekResults });
  }
  
  return allResults;
}

/**
 * Get standings for a division
 */
function getDivisionStandings(league, divisionKey) {
  const teams = league.divisions[divisionKey] || [];
  
  return teams
    .map(t => ({
      id: t.id,
      name: t.name,
      powerScore: t.powerScore,
      ...t.stats,
      winPct: t.stats.wins + t.stats.losses + t.stats.ties > 0
        ? t.stats.wins / (t.stats.wins + t.stats.losses + t.stats.ties)
        : 0,
      pointDiff: t.stats.pointsFor - t.stats.pointsAgainst,
    }))
    .sort((a, b) => {
      // Sort by win%, then point differential
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      return b.pointDiff - a.pointDiff;
    });
}

/**
 * Get full league standings (all divisions)
 */
function getLeagueStandings(league) {
  const standings = {};
  
  for (const divisionKey of Object.keys(DIVISIONS)) {
    standings[divisionKey] = getDivisionStandings(league, divisionKey);
  }
  
  return standings;
}

/**
 * Process promotion/relegation at end of season
 */
function processPromotionRelegation(league, promotionCount = 2, relegationCount = 2) {
  const changes = [];
  const divisionOrder = ['LEGENDARY', 'ELITE', 'PRO', 'AMATEUR', 'ROOKIE'];
  const movedTeams = new Set(); // Track teams that already moved
  
  for (let i = 0; i < divisionOrder.length - 1; i++) {
    const upperDiv = divisionOrder[i];
    const lowerDiv = divisionOrder[i + 1];
    
    const upperStandings = getDivisionStandings(league, upperDiv);
    const lowerStandings = getDivisionStandings(league, lowerDiv);
    
    // Bottom teams from upper division get relegated (skip if already moved)
    const relegated = upperStandings
      .filter(t => !movedTeams.has(t.id))
      .slice(-relegationCount);
    
    // Top teams from lower division get promoted (skip if already moved)
    const promoted = lowerStandings
      .filter(t => !movedTeams.has(t.id))
      .slice(0, promotionCount);
    
    for (const team of relegated) {
      const teamObj = league.teams.find(t => t.id === team.id);
      if (teamObj) {
        league.divisions[upperDiv] = league.divisions[upperDiv].filter(t => t.id !== team.id);
        league.divisions[lowerDiv].push(teamObj);
        teamObj.division = lowerDiv;
        movedTeams.add(team.id);
        changes.push({ team: team.name, from: upperDiv, to: lowerDiv, type: 'relegated' });
      }
    }
    
    for (const team of promoted) {
      const teamObj = league.teams.find(t => t.id === team.id);
      if (teamObj) {
        league.divisions[lowerDiv] = league.divisions[lowerDiv].filter(t => t.id !== team.id);
        league.divisions[upperDiv].push(teamObj);
        teamObj.division = upperDiv;
        movedTeams.add(team.id);
        changes.push({ team: team.name, from: lowerDiv, to: upperDiv, type: 'promoted' });
      }
    }
  }
  
  // Reset stats for new season
  for (const team of league.teams) {
    team.stats = {
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: 0,
    };
  }
  
  league.season++;
  league.week = 0;
  
  return changes;
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

/**
 * Format standings for display
 */
function formatStandings(league) {
  const lines = [];
  const standings = getLeagueStandings(league);
  
  lines.push(`${'='.repeat(70)}`);
  lines.push(`${league.name} - Season ${league.season}, Week ${league.week}`);
  lines.push(`${'='.repeat(70)}`);
  
  for (const [divisionKey, teams] of Object.entries(standings)) {
    if (teams.length === 0) continue;
    
    const divInfo = DIVISIONS[divisionKey];
    lines.push('');
    lines.push(`--- ${divInfo.name} Division ---`);
    lines.push(`${'Team'.padEnd(25)} ${'W'.padStart(4)} ${'L'.padStart(4)} ${'T'.padStart(4)} ${'Pct'.padStart(6)} ${'PF'.padStart(5)} ${'PA'.padStart(5)} ${'Diff'.padStart(6)}`);
    lines.push('-'.repeat(70));
    
    for (const team of teams) {
      const pct = (team.winPct * 100).toFixed(1);
      const diffStr = (team.pointDiff > 0 ? '+' : '') + team.pointDiff;
      lines.push(
        `${team.name.slice(0, 24).padEnd(25)} ${String(team.wins).padStart(4)} ${String(team.losses).padStart(4)} ${String(team.ties).padStart(4)} ${(pct + '%').padStart(6)} ${String(team.pointsFor).padStart(5)} ${String(team.pointsAgainst).padStart(5)} ${diffStr.padStart(6)}`
      );
    }
  }
  
  return lines.join('\n');
}

/**
 * Format power score breakdown
 */
function formatPowerBreakdown(roster) {
  const { powerScore, breakdown } = calculatePowerScore(roster);
  const division = getDivisionInfo(powerScore);
  
  const lines = [];
  lines.push(`Power Score: ${powerScore} (${division.name} Division)`);
  lines.push('-'.repeat(40));
  
  for (const [pos, data] of Object.entries(breakdown)) {
    if (data.avgTier !== undefined) {
      lines.push(`${pos}: Avg Tier ${data.avgTier.toFixed(1)} × ${data.count} = ${data.score.toFixed(1)}`);
    } else {
      lines.push(`${pos}: Tier ${data.tier} × ${data.weight} = ${data.score.toFixed(1)}`);
    }
  }
  
  return lines.join('\n');
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Division config
  DIVISIONS,
  POWER_WEIGHTS,
  
  // Power score
  calculatePowerScore,
  getDivision,
  getDivisionInfo,
  
  // League management
  createLeague,
  addTeamToLeague,
  generateDivisionSchedule,
  generateLeagueSchedule,
  
  // Simulation
  simulateLeagueGame,
  simulateWeek,
  simulateSeason,
  
  // Standings
  getDivisionStandings,
  getLeagueStandings,
  processPromotionRelegation,
  
  // Display
  formatStandings,
  formatPowerBreakdown,
};
