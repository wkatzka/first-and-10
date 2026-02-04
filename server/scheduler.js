/**
 * Game Scheduler
 * ===============
 * NFL-style structure:
 * - Regular season: Monday–Friday only (7 PM & 9 PM EST)
 * - Playoffs: Saturday (semifinals, top 4 by record)
 * - Super Bowl: Sunday
 * Schedule is calculated daily (next week / playoffs added at midnight).
 */

const fs = require('fs');
const path = require('path');
const db = require('./database');
const gameEngine = require('./game-bridge');

// Use persistent disk in production, local file in development
const DATA_DIR = fs.existsSync('/var/data') ? '/var/data' : __dirname;
const SCHEDULE_PATH = path.join(DATA_DIR, 'schedule.json');

// Game times in EST (24-hour format)
const GAME_TIMES = [19, 21]; // 7 PM and 9 PM EST

// Regular season = Mon–Fri only; then Saturday playoffs, Sunday Super Bowl
const REGULAR_SEASON_WEEKS = 4;
const PLAYOFF_TEAMS = 4; // top 4 by record get playoffs

// Required roster slots (11 total) as stored in DB rosters
const REQUIRED_SLOT_KEYS = [
  'qb_card_id', 'rb_card_id',
  'wr1_card_id', 'wr2_card_id', 'te_card_id',
  'ol_card_id', 'dl_card_id', 'lb_card_id',
  'db1_card_id', 'db2_card_id',
  'k_card_id',
];

function pairKey(a, b) {
  const x = Number(a);
  const y = Number(b);
  return x < y ? `${x}-${y}` : `${y}-${x}`;
}

function shuffleCopy(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Check if a user has a full roster (all 11 positions filled)
 * @param {number} userId - User ID to check
 * @returns {boolean} - True if roster is complete
 */
async function hasFullRoster(userId) {
  const full = await db.getFullRoster(userId);
  if (!full || !full.roster || !full.cards) return false;
  for (const key of REQUIRED_SLOT_KEYS) {
    const cardId = full.roster[key];
    const card = full.cards[key];
    if (!cardId || !card) return false;
  }
  return true;
}

async function getEligibleUsers(users) {
  const list = Array.isArray(users) ? users : [];
  const results = await Promise.all(list.map(async (user) => ({ user, ok: await hasFullRoster(user.id) })));
  return results.filter(r => r.ok).map(r => r.user);
}

/**
 * Load schedule from file
 */
function loadSchedule() {
  try {
    if (fs.existsSync(SCHEDULE_PATH)) {
      return JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load schedule:', err);
  }
  
  return {
    seasonStart: null,
    currentWeek: 0,
    phase: 'regular', // 'regular' | 'playoffs' | 'superbowl'
    games: [],
    completedGames: [],
  };
}

/**
 * Save schedule to file
 */
function saveSchedule(schedule) {
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2));
}

/**
 * Get current date in EST
 */
function getESTDate() {
  const now = new Date();
  // Convert to EST (UTC-5)
  const estOffset = -5 * 60; // minutes
  const utcOffset = now.getTimezoneOffset(); // minutes
  const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60000);
  return estTime;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get the next Monday from a given date
 */
function getNextMonday(from = new Date()) {
  const date = new Date(from);
  const day = date.getDay();
  const daysUntilMonday = day === 0 ? 1 : (8 - day);
  date.setDate(date.getDate() + daysUntilMonday);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Get the Monday of the current week (so the week includes today)
 */
function getThisMonday(from = new Date()) {
  const date = new Date(from);
  const day = date.getDay();
  const daysBack = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - daysBack);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Generate matchups for a set of users
 * Round-robin style: each user plays every other user twice (home/away)
 */
function generateMatchups(userIds) {
  const matchups = [];
  
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      // Each pair plays twice (home/away)
      matchups.push({ home: userIds[i], away: userIds[j] });
      matchups.push({ home: userIds[j], away: userIds[i] });
    }
  }
  
  // Shuffle matchups
  for (let i = matchups.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [matchups[i], matchups[j]] = [matchups[j], matchups[i]];
  }
  
  return matchups;
}

/**
 * Compute standings from completed games (regular season only).
 * Returns array of { userId, wins, losses, user } sorted by wins desc, then losses asc.
 */
async function getStandings(schedule) {
  const wins = new Map();
  const users = await db.getAllUsers();
  const userMap = {};
  for (const u of users) userMap[u.id] = u;

  for (const g of schedule.games) {
    if (g.status !== 'completed' || (g.phase && g.phase !== 'regular')) continue;
    const r = g.result;
    if (!r || r.type === 'bye') continue;
    const homeId = g.homeUserId;
    const awayId = g.awayUserId;
    if (!wins.has(homeId)) wins.set(homeId, { wins: 0, losses: 0 });
    if (awayId && !wins.has(awayId)) wins.set(awayId, { wins: 0, losses: 0 });
    if (r.winner === 'home') {
      wins.get(homeId).wins++;
      if (awayId) wins.get(awayId).losses++;
    } else if (r.winner === 'away') {
      wins.get(awayId).wins++;
      wins.get(homeId).losses++;
    }
  }

  const list = [];
  for (const [userId, rec] of wins) {
    list.push({ userId, wins: rec.wins, losses: rec.losses, user: userMap[userId] || null });
  }
  list.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  return list;
}

/**
 * Generate a daily schedule
 * Each user gets 2 games per day (one at 7 PM, one at 9 PM)
 */
function generateDailySchedule(date, users, phase = 'regular') {
  const games = [];
  const userIds = users.map(u => u.id);
  
  if (userIds.length < 2) {
    return games;
  }
  
  // Track same-day opponents to avoid rematches across the two daily games.
  const opponentsByUser = new Map(userIds.map(id => [id, new Set()]));
  const usedPairsToday = new Set();

  const dateStr = formatDate(date);
  
  // Generate pairings for each time slot
  for (const hour of GAME_TIMES) {
    const usedUsersThisSlot = new Set();
    const slotGames = [];
    const shuffled = shuffleCopy(userIds);

    // Greedy matching: prefer opponents you haven't played yet today
    for (let i = 0; i < shuffled.length; i++) {
      const a = shuffled[i];
      if (usedUsersThisSlot.has(a)) continue;

      // Find best available opponent
      let chosenIdx = -1;
      for (let j = i + 1; j < shuffled.length; j++) {
        const b = shuffled[j];
        if (usedUsersThisSlot.has(b)) continue;
        const alreadyOpp = opponentsByUser.get(a)?.has(b) || opponentsByUser.get(b)?.has(a);
        const alreadyPair = usedPairsToday.has(pairKey(a, b));
        if (!alreadyOpp && !alreadyPair) {
          chosenIdx = j;
          break;
        }
      }

      // Relax constraint if needed (small leagues)
      if (chosenIdx === -1) {
        for (let j = i + 1; j < shuffled.length; j++) {
          const b = shuffled[j];
          if (usedUsersThisSlot.has(b)) continue;
          const alreadyOpp = opponentsByUser.get(a)?.has(b) || opponentsByUser.get(b)?.has(a);
          if (!alreadyOpp) {
            chosenIdx = j;
            break;
          }
        }
      }

      // Last resort: allow rematch
      if (chosenIdx === -1) {
        for (let j = i + 1; j < shuffled.length; j++) {
          const b = shuffled[j];
          if (usedUsersThisSlot.has(b)) continue;
          chosenIdx = j;
          break;
        }
      }

      if (chosenIdx === -1) {
        // No opponent left => bye
        slotGames.push({
          id: `${dateStr}_${hour}_${a}_bye`,
          date: dateStr,
          time: hour,
          timeDisplay: hour === 19 ? '7:00 PM EST' : '9:00 PM EST',
          homeUserId: a,
          awayUserId: null,
          status: 'bye',
          result: null,
          phase: phase || 'regular',
        });
        usedUsersThisSlot.add(a);
        continue;
      }

      const b = shuffled[chosenIdx];
      usedUsersThisSlot.add(a);
      usedUsersThisSlot.add(b);

      // Randomize home/away
      const homeUserId = Math.random() < 0.5 ? a : b;
      const awayUserId = homeUserId === a ? b : a;

      slotGames.push({
        id: `${dateStr}_${hour}_${homeUserId}_${awayUserId}`,
        date: dateStr,
        time: hour,
        timeDisplay: hour === 19 ? '7:00 PM EST' : '9:00 PM EST',
        homeUserId,
        awayUserId,
        status: 'scheduled',
        result: null,
        phase: phase || 'regular',
      });

      opponentsByUser.get(a)?.add(b);
      opponentsByUser.get(b)?.add(a);
      usedPairsToday.add(pairKey(a, b));
    }

    games.push(...slotGames);
  }
  
  return games;
}

/**
 * Regular season: Monday–Friday only (5 days)
 */
function generateRegularSeasonWeekSchedule(weekStart, users) {
  const schedule = [];
  const date = new Date(weekStart);
  for (let day = 0; day < 5; day++) {
    const dayGames = generateDailySchedule(date, users, 'regular');
    schedule.push(...dayGames);
    date.setDate(date.getDate() + 1);
  }
  return schedule;
}

/**
 * Generate schedule for a full week (all 7 days) - used only for legacy/init fallback
 */
function generateWeekSchedule(startDate, users) {
  const schedule = [];
  const date = new Date(startDate);
  for (let day = 0; day < 7; day++) {
    const dayGames = generateDailySchedule(date, users, 'regular');
    schedule.push(...dayGames);
    date.setDate(date.getDate() + 1);
  }
  return schedule;
}

/**
 * Playoff Saturday: top 4 by standings, 1 vs 4 and 2 vs 3 (7 PM and 9 PM)
 */
function generatePlayoffSaturday(saturdayDateStr, standings) {
  const top4 = standings.slice(0, PLAYOFF_TEAMS).map(s => s.userId);
  if (top4.length < 4) return [];
  const games = [
    {
      id: `playoff_semi_1_${saturdayDateStr}`,
      date: saturdayDateStr,
      time: 19,
      timeDisplay: '7:00 PM EST',
      homeUserId: top4[0],
      awayUserId: top4[3],
      status: 'scheduled',
      result: null,
      phase: 'playoff_semi',
      seedHome: 1,
      seedAway: 4,
    },
    {
      id: `playoff_semi_2_${saturdayDateStr}`,
      date: saturdayDateStr,
      time: 21,
      timeDisplay: '9:00 PM EST',
      homeUserId: top4[1],
      awayUserId: top4[2],
      status: 'scheduled',
      result: null,
      phase: 'playoff_semi',
      seedHome: 2,
      seedAway: 3,
    },
  ];
  return games;
}

/**
 * Super Bowl Sunday: winners of the two semifinal games (single game, 7 PM)
 */
function generateSuperBowlSunday(sundayDateStr, schedule) {
  const semis = schedule.games.filter(g => g.phase === 'playoff_semi' && g.status === 'completed');
  if (semis.length < 2) return [];
  const winner1 = semis[0].result?.winner === 'home' ? semis[0].homeUserId : semis[0].awayUserId;
  const winner2 = semis[1].result?.winner === 'home' ? semis[1].homeUserId : semis[1].awayUserId;
  return [
    {
      id: `superbowl_${sundayDateStr}`,
      date: sundayDateStr,
      time: 19,
      timeDisplay: '7:00 PM EST',
      homeUserId: winner1,
      awayUserId: winner2,
      status: 'scheduled',
      result: null,
      phase: 'superbowl',
    },
  ];
}

/**
 * Initialize or update the season schedule
 */
async function initializeSchedule(forceReset = false) {
  let schedule = loadSchedule();
  const allUsersRaw = await db.getAllUsers();
  const allUsers = Array.isArray(allUsersRaw) ? allUsersRaw : [];
  const eligibleUsers = await getEligibleUsers(allUsers);
  
  console.log(`Scheduling: ${eligibleUsers.length}/${allUsers.length} users have full rosters`);
  
  if (eligibleUsers.length < 2) {
    console.log('Not enough users with full rosters to generate schedule (need at least 2)');
    return schedule;
  }
  
  const now = getESTDate();
  if (!schedule.phase) schedule.phase = 'regular';

  // If no season start or force reset: regular season Mon–Fri only, start this week
  if (!schedule.seasonStart || forceReset) {
    const weekStart = getThisMonday(now);
    schedule.seasonStart = formatDate(weekStart);
    schedule.currentWeek = 1;
    schedule.phase = 'regular';
    schedule.games = [];
    schedule.completedGames = [];

    // Week 1 only (Mon–Fri); more weeks added daily by checkAndGenerateNextWeek
    schedule.games = generateRegularSeasonWeekSchedule(weekStart, eligibleUsers);

    saveSchedule(schedule);
    console.log(`Season (re)initialized. Regular season week 1 (Mon–Fri), ${schedule.games.length} games`);
  }
  
  return schedule;
}

/**
 * Get tomorrow's schedule (released a day in advance)
 */
function getTomorrowSchedule() {
  const schedule = loadSchedule();
  const tomorrow = getESTDate();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);
  
  return schedule.games.filter(g => g.date === tomorrowStr);
}

/**
 * Get today's schedule
 */
function getTodaySchedule() {
  const schedule = loadSchedule();
  const today = formatDate(getESTDate());
  
  return schedule.games.filter(g => g.date === today);
}

/**
 * Get games that should be run now
 */
function getGamesToRun() {
  const schedule = loadSchedule();
  const now = getESTDate();
  const today = formatDate(now);
  const currentHour = now.getHours();
  
  return schedule.games.filter(g => 
    g.date === today && 
    g.time <= currentHour && 
    g.status === 'scheduled'
  );
}

/**
 * Run a scheduled game
 */
async function runScheduledGame(game) {
  const schedule = loadSchedule();
  
  // Find the game in schedule
  const gameIndex = schedule.games.findIndex(g => g.id === game.id);
  if (gameIndex === -1) {
    console.error('Game not found in schedule:', game.id);
    return null;
  }
  
  // Handle bye games
  if (game.status === 'bye' || !game.awayUserId) {
    schedule.games[gameIndex].status = 'completed';
    schedule.games[gameIndex].result = { type: 'bye' };
    saveSchedule(schedule);
    return { type: 'bye', userId: game.homeUserId };
  }
  
  // Get rosters
  const homeRoster = await db.getFullRoster(game.homeUserId);
  const awayRoster = await db.getFullRoster(game.awayUserId);
  
  // Check if rosters are set
  if (!homeRoster || Object.keys(homeRoster.cards).length === 0) {
    schedule.games[gameIndex].status = 'forfeit';
    schedule.games[gameIndex].result = { 
      winner: 'away', 
      reason: 'Home team has no roster',
      homeScore: 0,
      awayScore: 1,
    };
    saveSchedule(schedule);
    
    await db.recordGame(game.homeUserId, game.awayUserId, 0, 1, game.awayUserId, []);
    return schedule.games[gameIndex].result;
  }
  
  if (!awayRoster || Object.keys(awayRoster.cards).length === 0) {
    schedule.games[gameIndex].status = 'forfeit';
    schedule.games[gameIndex].result = { 
      winner: 'home', 
      reason: 'Away team has no roster',
      homeScore: 1,
      awayScore: 0,
    };
    saveSchedule(schedule);
    
    await db.recordGame(game.homeUserId, game.awayUserId, 1, 0, game.homeUserId, []);
    return schedule.games[gameIndex].result;
  }
  
  // Run the simulation
  try {
    const result = gameEngine.simulateGameFromDB(homeRoster, awayRoster);
    
    // Determine winner
    let winnerId = null;
    if (result.homeScore > result.awayScore) {
      winnerId = game.homeUserId;
    } else if (result.awayScore > result.homeScore) {
      winnerId = game.awayUserId;
    }
    
    // Update schedule
    schedule.games[gameIndex].status = 'completed';
    schedule.games[gameIndex].result = {
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      winner: winnerId === game.homeUserId ? 'home' : winnerId === game.awayUserId ? 'away' : 'tie',
    };
    
    const gameId = await db.recordGame(
      game.homeUserId,
      game.awayUserId,
      result.homeScore,
      result.awayScore,
      winnerId,
      result.plays
    );
    
    schedule.games[gameIndex].dbGameId = gameId;
    saveSchedule(schedule);
    
    console.log(`Game completed: ${game.id} - ${result.homeScore} to ${result.awayScore}`);
    
    return schedule.games[gameIndex].result;
  } catch (err) {
    console.error('Error running game:', err);
    schedule.games[gameIndex].status = 'error';
    schedule.games[gameIndex].result = { error: err.message };
    saveSchedule(schedule);
    return null;
  }
}

/**
 * Run all pending games for the current time slot
 */
async function runPendingGames() {
  const games = getGamesToRun();
  const results = [];
  console.log(`Running ${games.length} pending games...`);
  for (const game of games) {
    const result = await runScheduledGame(game);
    results.push({ gameId: game.id, result });
  }
  return results;
}

/**
 * Daily: add next regular week, or playoff Saturday, or Super Bowl Sunday
 */
async function checkAndGenerateNextWeek() {
  const schedule = loadSchedule();
  const now = getESTDate();
  const today = formatDate(now);
  if (!schedule.phase) schedule.phase = 'regular';

  const scheduledDates = [...new Set(schedule.games.map(g => g.date))];
  if (scheduledDates.length === 0) return;

  const lastDate = scheduledDates.sort().pop();
  const lastDateObj = new Date(lastDate + 'T12:00:00');
  const todayObj = new Date(today + 'T12:00:00');
  const daysRemaining = Math.round((lastDateObj - todayObj) / (1000 * 60 * 60 * 24));

  if (daysRemaining > 2) return;

  const allUsersRaw = await db.getAllUsers();
  const allUsers = Array.isArray(allUsersRaw) ? allUsersRaw : [];
  const eligibleUsers = await getEligibleUsers(allUsers);
  if (eligibleUsers.length < 2) return;

  // Next calendar day after lastDate
  const nextDay = new Date(lastDateObj);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = formatDate(nextDay);

  if (schedule.phase === 'regular') {
    if (schedule.currentWeek < REGULAR_SEASON_WEEKS) {
      // Next Monday after lastDate (day 0=Sun -> +1, 1=Mon -> +7, ..., 5=Fri -> +3)
      const dayOfWeek = lastDateObj.getDay();
      const daysToNextMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
      const nextMonday = new Date(lastDateObj);
      nextMonday.setDate(nextMonday.getDate() + daysToNextMonday);
      const newGames = generateRegularSeasonWeekSchedule(nextMonday, eligibleUsers);
      schedule.games.push(...newGames);
      schedule.currentWeek++;
      saveSchedule(schedule);
      console.log(`Generated regular season week ${schedule.currentWeek} (Mon–Fri)`);
    } else {
      const standings = await getStandings(schedule);
      if (standings.length < 4) {
        console.log('Not enough teams (4) for playoffs; skipping playoff week');
        return;
      }
      const playoffGames = generatePlayoffSaturday(nextDayStr, standings);
      schedule.games.push(...playoffGames);
      schedule.phase = 'playoffs';
      saveSchedule(schedule);
      console.log(`Generated playoff Saturday (top 4 by record)`);
    }
    return;
  }

  if (schedule.phase === 'playoffs') {
    const semis = schedule.games.filter(g => g.phase === 'playoff_semi' && g.status === 'completed');
    if (semis.length < 2) return;
    const superBowlGames = generateSuperBowlSunday(nextDayStr, schedule);
    if (superBowlGames.length === 0) return;
    schedule.games.push(...superBowlGames);
    schedule.phase = 'superbowl';
    saveSchedule(schedule);
    console.log('Generated Super Bowl Sunday');
  }
}

/**
 * Get full schedule with user details
 */
async function getScheduleWithDetails() {
  const schedule = loadSchedule();
  const users = await db.getAllUsers();
  const userMap = {};
  
  for (const user of users) {
    userMap[user.id] = user;
  }
  
  return {
    ...schedule,
    games: schedule.games.map(g => ({
      ...g,
      homeUser: userMap[g.homeUserId] || null,
      awayUser: g.awayUserId ? userMap[g.awayUserId] : null,
    })),
  };
}

/**
 * Start the scheduler (runs every minute to check for games)
 */
function startScheduler() {
  console.log('Game scheduler started');
  initializeSchedule().catch(err => console.error('Schedule init error:', err));
  
  // Check every minute for games to run
  setInterval(() => {
    const now = getESTDate();
    const minute = now.getMinutes();
    
    // Run games at the top of each game hour (7 PM, 9 PM)
    if (minute === 0 && GAME_TIMES.includes(now.getHours())) {
      console.log(`Game time! Running scheduled games at ${now.getHours()}:00 EST`);
      runPendingGames().catch(err => console.error('runPendingGames error:', err));
    }
    if (now.getHours() === 0 && minute === 0) {
      checkAndGenerateNextWeek().catch(err => console.error('checkAndGenerateNextWeek error:', err));
    }
  }, 60000);
  runPendingGames().catch(err => console.error('runPendingGames error:', err));
}

module.exports = {
  loadSchedule,
  saveSchedule,
  initializeSchedule,
  getStandings,
  generateDailySchedule,
  generateRegularSeasonWeekSchedule,
  generateWeekSchedule,
  getTodaySchedule,
  getTomorrowSchedule,
  getGamesToRun,
  runScheduledGame,
  runPendingGames,
  getScheduleWithDetails,
  checkAndGenerateNextWeek,
  startScheduler,
  getESTDate,
  formatDate,
  hasFullRoster,
  getEligibleUsers,
};
