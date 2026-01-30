/**
 * Game Scheduler
 * ===============
 * Automatically schedules and runs games at set times.
 * - 2 games per user per day (7 PM and 9 PM EST)
 * - Schedule released 1 day in advance
 * - Season starts on Monday
 */

const fs = require('fs');
const path = require('path');
const db = require('./database');
const gameEngine = require('./game-bridge');

const SCHEDULE_PATH = path.join(__dirname, 'schedule.json');

// Game times in EST (24-hour format)
const GAME_TIMES = [19, 21]; // 7 PM and 9 PM EST

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
 * Generate a daily schedule
 * Each user gets 2 games per day (one at 7 PM, one at 9 PM)
 */
function generateDailySchedule(date, users) {
  const games = [];
  const userIds = users.map(u => u.id);
  
  if (userIds.length < 2) {
    return games;
  }
  
  // For small groups, we may need to have some users play same opponent twice
  // or have "bye" games against CPU
  
  const dateStr = formatDate(date);
  
  // Generate pairings for each time slot
  for (const hour of GAME_TIMES) {
    const usedUsers = new Set();
    const slotGames = [];
    
    // Shuffle users for this slot
    const shuffled = [...userIds].sort(() => Math.random() - 0.5);
    
    // Pair up users
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      if (!usedUsers.has(shuffled[i]) && !usedUsers.has(shuffled[i + 1])) {
        slotGames.push({
          id: `${dateStr}_${hour}_${shuffled[i]}_${shuffled[i + 1]}`,
          date: dateStr,
          time: hour,
          timeDisplay: hour === 19 ? '7:00 PM EST' : '9:00 PM EST',
          homeUserId: shuffled[i],
          awayUserId: shuffled[i + 1],
          status: 'scheduled',
          result: null,
        });
        usedUsers.add(shuffled[i]);
        usedUsers.add(shuffled[i + 1]);
      }
    }
    
    // If odd number of users, last user gets a "bye" or plays CPU
    if (shuffled.length % 2 === 1) {
      const byeUser = shuffled[shuffled.length - 1];
      slotGames.push({
        id: `${dateStr}_${hour}_${byeUser}_bye`,
        date: dateStr,
        time: hour,
        timeDisplay: hour === 19 ? '7:00 PM EST' : '9:00 PM EST',
        homeUserId: byeUser,
        awayUserId: null, // Bye game
        status: 'bye',
        result: null,
      });
    }
    
    games.push(...slotGames);
  }
  
  return games;
}

/**
 * Generate schedule for a full week
 */
function generateWeekSchedule(startDate, users) {
  const schedule = [];
  const date = new Date(startDate);
  
  for (let day = 0; day < 7; day++) {
    const dayGames = generateDailySchedule(date, users);
    schedule.push(...dayGames);
    date.setDate(date.getDate() + 1);
  }
  
  return schedule;
}

/**
 * Initialize or update the season schedule
 */
function initializeSchedule(forceReset = false) {
  let schedule = loadSchedule();
  const users = db.getAllUsers();
  
  if (users.length < 2) {
    console.log('Not enough users to generate schedule (need at least 2)');
    return schedule;
  }
  
  const now = getESTDate();
  
  // If no season start or force reset, start next Monday
  if (!schedule.seasonStart || forceReset) {
    schedule.seasonStart = formatDate(getNextMonday(now));
    schedule.currentWeek = 1;
    schedule.games = [];
    schedule.completedGames = [];
    
    // Generate first week's schedule
    const weekStart = new Date(schedule.seasonStart);
    schedule.games = generateWeekSchedule(weekStart, users);
    
    saveSchedule(schedule);
    console.log(`Season initialized. Starts ${schedule.seasonStart}`);
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
function runScheduledGame(game) {
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
  const homeRoster = db.getFullRoster(game.homeUserId);
  const awayRoster = db.getFullRoster(game.awayUserId);
  
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
    
    // Record forfeit in DB
    db.recordGame(game.homeUserId, game.awayUserId, 0, 1, game.awayUserId, []);
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
    
    db.recordGame(game.homeUserId, game.awayUserId, 1, 0, game.homeUserId, []);
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
    
    // Record in database
    const gameId = db.recordGame(
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
function runPendingGames() {
  const games = getGamesToRun();
  const results = [];
  
  console.log(`Running ${games.length} pending games...`);
  
  for (const game of games) {
    const result = runScheduledGame(game);
    results.push({ gameId: game.id, result });
  }
  
  return results;
}

/**
 * Check if we need to generate next week's schedule
 */
function checkAndGenerateNextWeek() {
  const schedule = loadSchedule();
  const now = getESTDate();
  const today = formatDate(now);
  
  // Get last scheduled date
  const scheduledDates = [...new Set(schedule.games.map(g => g.date))];
  if (scheduledDates.length === 0) return;
  
  const lastDate = scheduledDates.sort().pop();
  const lastDateObj = new Date(lastDate);
  const todayObj = new Date(today);
  
  // If we're within 2 days of the end of schedule, generate next week
  const daysRemaining = Math.floor((lastDateObj - todayObj) / (1000 * 60 * 60 * 24));
  
  if (daysRemaining <= 2) {
    const users = db.getAllUsers();
    const nextWeekStart = new Date(lastDateObj);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    
    const newGames = generateWeekSchedule(nextWeekStart, users);
    schedule.games.push(...newGames);
    schedule.currentWeek++;
    
    saveSchedule(schedule);
    console.log(`Generated week ${schedule.currentWeek} schedule`);
  }
}

/**
 * Get full schedule with user details
 */
function getScheduleWithDetails() {
  const schedule = loadSchedule();
  const users = db.getAllUsers();
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
  
  // Initialize schedule if needed
  initializeSchedule();
  
  // Check every minute for games to run
  setInterval(() => {
    const now = getESTDate();
    const minute = now.getMinutes();
    
    // Run games at the top of each game hour (7 PM, 9 PM)
    if (minute === 0 && GAME_TIMES.includes(now.getHours())) {
      console.log(`Game time! Running scheduled games at ${now.getHours()}:00 EST`);
      runPendingGames();
    }
    
    // Check for next week schedule generation at midnight
    if (now.getHours() === 0 && minute === 0) {
      checkAndGenerateNextWeek();
    }
  }, 60000); // Check every minute
  
  // Also run any pending games on startup
  runPendingGames();
}

module.exports = {
  loadSchedule,
  saveSchedule,
  initializeSchedule,
  generateDailySchedule,
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
};
