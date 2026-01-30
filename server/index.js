/**
 * First & 10 - API Server
 * ===========================
 * Express server for the MVP web app
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./database');
const packs = require('./packs');
const gameEngine = require('./game-bridge');
const mintingLedger = require('./minting-ledger');
const scheduler = require('./scheduler');
const cardImageGenerator = require('./card-image-generator');
const pressConference = require('./press-conference');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// CORS configuration for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3003',
  process.env.FRONTEND_URL, // Vercel URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Simple session management (in-memory for MVP)
const sessions = new Map();

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  req.user = sessions.get(token);
  next();
}

// =============================================================================
// AUTH ROUTES
// =============================================================================

// Register
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }
    
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    
    const user = db.createUser(username, password);
    const token = generateToken();
    sessions.set(token, user);
    
    res.json({ user, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const user = db.authenticateUser(username, password);
    const token = generateToken();
    sessions.set(token, user);
    
    res.json({ user, token });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Logout
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  sessions.delete(token);
  res.json({ success: true });
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.getUser(req.user.id);
  const stats = db.getUserStats(req.user.id);
  res.json({ user, stats });
});

// =============================================================================
// PACK ROUTES
// =============================================================================

// Get pack info
app.get('/api/packs/info', authMiddleware, (req, res) => {
  const user = db.getUser(req.user.id);
  const packStats = packs.getPackStats();
  const availability = mintingLedger.getAvailabilityStats();
  
  res.json({
    packsOpened: user.packs_opened,
    maxPacks: user.max_packs,
    packsRemaining: user.max_packs - user.packs_opened,
    tierRates: packStats.expectedRates,
    cardAvailability: availability,
  });
});

// Open a pack
app.post('/api/packs/open', authMiddleware, (req, res) => {
  try {
    const user = db.getUser(req.user.id);
    
    if (user.packs_opened >= user.max_packs) {
      return res.status(400).json({ error: 'No packs remaining' });
    }
    
    // Determine pack type
    const isStarterPack = user.packs_opened < 3; // First 3 are starter packs
    const cards = isStarterPack ? packs.openStarterPack() : packs.openPack();
    
    if (cards.length === 0) {
      return res.status(400).json({ error: 'No cards available to mint' });
    }
    
    // Save cards to database AND mint them (mark as taken)
    const savedCards = [];
    for (const card of cards) {
      // Mint the card (mark as taken in ledger)
      try {
        mintingLedger.mintCard(card, req.user.id);
      } catch (mintErr) {
        console.error('Mint error (skipping):', mintErr.message);
        continue; // Skip if already minted somehow
      }
      
      // Generate card image
      const imageUrl = cardImageGenerator.getOrGenerateCardImage(card);
      card.image_url = imageUrl;
      
      const cardId = db.addCard(req.user.id, card);
      savedCards.push({ id: cardId, ...card, image_url: imageUrl });
    }
    
    // Increment packs opened
    db.incrementPacksOpened(req.user.id);
    
    res.json({
      packType: isStarterPack ? 'starter' : 'bonus',
      packNumber: user.packs_opened + 1,
      cards: savedCards,
      packsRemaining: user.max_packs - user.packs_opened - 1,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Open all remaining packs at once
app.post('/api/packs/open-all', authMiddleware, (req, res) => {
  try {
    const user = db.getUser(req.user.id);
    const remaining = user.max_packs - user.packs_opened;
    
    if (remaining <= 0) {
      return res.status(400).json({ error: 'No packs remaining' });
    }
    
    const allCards = [];
    
    for (let i = 0; i < remaining; i++) {
      const currentPackNum = user.packs_opened + i;
      const isStarterPack = currentPackNum < 3;
      const cards = isStarterPack ? packs.openStarterPack() : packs.openPack();
      
      for (const card of cards) {
        // Mint the card (mark as taken in ledger)
        try {
          mintingLedger.mintCard(card, req.user.id);
        } catch (mintErr) {
          console.error('Mint error (skipping):', mintErr.message);
          continue;
        }
        
        // Generate card image
        const imageUrl = cardImageGenerator.getOrGenerateCardImage(card);
        card.image_url = imageUrl;
        
        const cardId = db.addCard(req.user.id, card);
        allCards.push({ 
          id: cardId, 
          ...card,
          image_url: imageUrl,
          packNumber: currentPackNum + 1,
          packType: isStarterPack ? 'starter' : 'bonus'
        });
      }
      
      db.incrementPacksOpened(req.user.id);
    }
    
    res.json({
      packsOpened: remaining,
      totalCards: allCards.length,
      cards: allCards,
      packsRemaining: 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// CARD ROUTES
// =============================================================================

// Get all user's cards
app.get('/api/cards', authMiddleware, (req, res) => {
  const cards = db.getUserCards(req.user.id);
  res.json({ cards });
});

// Get cards by position
app.get('/api/cards/position/:position', authMiddleware, (req, res) => {
  const cards = db.getUserCardsByPosition(req.user.id, req.params.position.toUpperCase());
  res.json({ cards });
});

// Get single card
app.get('/api/cards/:id', authMiddleware, (req, res) => {
  const card = db.getCard(parseInt(req.params.id));
  
  if (!card || card.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Card not found' });
  }
  
  res.json({ card });
});

// =============================================================================
// ROSTER ROUTES
// =============================================================================

// Get user's roster
app.get('/api/roster', authMiddleware, (req, res) => {
  const fullRoster = db.getFullRoster(req.user.id);
  res.json(fullRoster);
});

// Update roster slot
app.put('/api/roster', authMiddleware, (req, res) => {
  try {
    const { slots } = req.body;
    
    if (!slots || typeof slots !== 'object') {
      return res.status(400).json({ error: 'Invalid slots data' });
    }
    
    // Verify all cards belong to user
    for (const [slot, cardId] of Object.entries(slots)) {
      if (cardId !== null) {
        const card = db.getCard(cardId);
        if (!card || card.user_id !== req.user.id) {
          return res.status(400).json({ error: `Card ${cardId} not found or not owned` });
        }
      }
    }
    
    db.updateRoster(req.user.id, slots);
    const fullRoster = db.getFullRoster(req.user.id);
    res.json(fullRoster);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-fill roster with best available cards
app.post('/api/roster/auto-fill', authMiddleware, (req, res) => {
  try {
    const cards = db.getUserCards(req.user.id);
    const slots = gameEngine.autoFillRoster(cards);
    db.updateRoster(req.user.id, slots);
    const fullRoster = db.getFullRoster(req.user.id);
    res.json(fullRoster);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// GAME ROUTES
// =============================================================================

// Get list of opponents
app.get('/api/opponents', authMiddleware, (req, res) => {
  const users = db.getAllUsers().filter(u => u.id !== req.user.id);
  
  // Add stats for each user
  const opponents = users.map(u => {
    const stats = db.getUserStats(u.id);
    return { ...u, stats };
  });
  
  res.json({ opponents });
});

// Challenge an opponent
app.post('/api/game/challenge', authMiddleware, (req, res) => {
  try {
    const { opponentId } = req.body;
    
    if (!opponentId) {
      return res.status(400).json({ error: 'Opponent ID required' });
    }
    
    const opponent = db.getUser(opponentId);
    if (!opponent) {
      return res.status(404).json({ error: 'Opponent not found' });
    }
    
    // Get both rosters
    const homeRoster = db.getFullRoster(req.user.id);
    const awayRoster = db.getFullRoster(opponentId);
    
    if (!homeRoster || Object.keys(homeRoster.cards).length === 0) {
      return res.status(400).json({ error: 'You need to set up your roster first' });
    }
    
    if (!awayRoster || Object.keys(awayRoster.cards).length === 0) {
      return res.status(400).json({ error: 'Opponent has not set up their roster yet' });
    }
    
    // Run simulation
    const result = gameEngine.simulateGameFromDB(homeRoster, awayRoster);
    
    // Determine winner
    let winnerId = null;
    if (result.homeScore > result.awayScore) {
      winnerId = req.user.id;
    } else if (result.awayScore > result.homeScore) {
      winnerId = opponentId;
    }
    
    // Save game
    const gameId = db.recordGame(
      req.user.id,
      opponentId,
      result.homeScore,
      result.awayScore,
      winnerId,
      result.plays
    );
    
    // Create post-game press conference (30 min chat window)
    pressConference.createConference(
      gameId,
      req.user.id,
      opponentId,
      req.user.username,
      opponent.username
    );
    
    res.json({
      gameId,
      home: {
        id: req.user.id,
        username: req.user.username,
        score: result.homeScore,
      },
      away: {
        id: opponent.id,
        username: opponent.username,
        score: result.awayScore,
      },
      winner: winnerId === req.user.id ? 'home' : winnerId === opponentId ? 'away' : 'tie',
      summary: result.summary,
      pressConference: {
        available: true,
        duration: '30 minutes',
      },
    });
  } catch (err) {
    console.error('Game error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Quick match (random opponent)
app.post('/api/game/quick-match', authMiddleware, (req, res) => {
  try {
    // Find random opponent with a roster
    const users = db.getAllUsers().filter(u => u.id !== req.user.id);
    
    if (users.length === 0) {
      return res.status(400).json({ error: 'No opponents available' });
    }
    
    // Filter to users with rosters
    const validOpponents = users.filter(u => {
      const roster = db.getFullRoster(u.id);
      return roster && Object.keys(roster.cards).length > 0;
    });
    
    if (validOpponents.length === 0) {
      return res.status(400).json({ error: 'No opponents with rosters available' });
    }
    
    const opponent = validOpponents[Math.floor(Math.random() * validOpponents.length)];
    
    // Forward to challenge endpoint
    req.body.opponentId = opponent.id;
    
    // Get both rosters
    const homeRoster = db.getFullRoster(req.user.id);
    const awayRoster = db.getFullRoster(opponent.id);
    
    if (!homeRoster || Object.keys(homeRoster.cards).length === 0) {
      return res.status(400).json({ error: 'You need to set up your roster first' });
    }
    
    // Run simulation
    const result = gameEngine.simulateGameFromDB(homeRoster, awayRoster);
    
    // Determine winner
    let winnerId = null;
    if (result.homeScore > result.awayScore) {
      winnerId = req.user.id;
    } else if (result.awayScore > result.homeScore) {
      winnerId = opponent.id;
    }
    
    // Save game
    const gameId = db.recordGame(
      req.user.id,
      opponent.id,
      result.homeScore,
      result.awayScore,
      winnerId,
      result.plays
    );
    
    // Create post-game press conference (30 min chat window)
    pressConference.createConference(
      gameId,
      req.user.id,
      opponent.id,
      req.user.username,
      opponent.username
    );
    
    res.json({
      gameId,
      home: {
        id: req.user.id,
        username: req.user.username,
        score: result.homeScore,
      },
      away: {
        id: opponent.id,
        username: opponent.username,
        score: result.awayScore,
      },
      winner: winnerId === req.user.id ? 'home' : winnerId === opponent.id ? 'away' : 'tie',
      summary: result.summary,
      pressConference: {
        available: true,
        duration: '30 minutes',
      },
    });
  } catch (err) {
    console.error('Quick match error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get game details
app.get('/api/game/:id', authMiddleware, (req, res) => {
  const game = db.getGame(parseInt(req.params.id));
  
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json({ game });
});

// Get user's game history
app.get('/api/games', authMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const games = db.getUserGames(req.user.id, limit);
  res.json({ games });
});

// =============================================================================
// PRESS CONFERENCE (Post-Game Chat)
// =============================================================================

// Get all active press conferences for the current user
app.get('/api/press-conference', authMiddleware, (req, res) => {
  const conferences = pressConference.getActiveConferencesForUser(req.user.id);
  res.json({ conferences });
});

// Get messages for a specific game's press conference
app.get('/api/press-conference/:gameId', authMiddleware, (req, res) => {
  const gameId = parseInt(req.params.gameId);
  const since = req.query.since || null;
  
  const result = pressConference.getMessages(gameId, req.user.id, since);
  
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  
  res.json(result);
});

// Send a message in a press conference
app.post('/api/press-conference/:gameId/message', authMiddleware, (req, res) => {
  const gameId = parseInt(req.params.gameId);
  const { content } = req.body;
  
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Message content required' });
  }
  
  const result = pressConference.sendMessage(
    gameId,
    req.user.id,
    req.user.username,
    content
  );
  
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  
  res.json(result);
});

// =============================================================================
// LEADERBOARD
// =============================================================================

app.get('/api/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const leaderboard = db.getLeaderboard(limit);
  res.json({ leaderboard });
});

// =============================================================================
// SEARCH (for testing)
// =============================================================================

app.get('/api/players/search', authMiddleware, (req, res) => {
  const query = req.query.q || '';
  const results = packs.searchPlayers(query, 20);
  res.json({ players: results });
});

// =============================================================================
// SCHEDULE ROUTES
// =============================================================================

// Get today's schedule
app.get('/api/schedule/today', authMiddleware, (req, res) => {
  const games = scheduler.getTodaySchedule();
  const users = db.getAllUsers();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  
  const gamesWithUsers = games.map(g => ({
    ...g,
    homeUser: userMap[g.homeUserId] || null,
    awayUser: g.awayUserId ? userMap[g.awayUserId] : null,
  }));
  
  res.json({ 
    date: scheduler.formatDate(scheduler.getESTDate()),
    games: gamesWithUsers,
  });
});

// Get tomorrow's schedule
app.get('/api/schedule/tomorrow', authMiddleware, (req, res) => {
  const games = scheduler.getTomorrowSchedule();
  const users = db.getAllUsers();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  
  const tomorrow = scheduler.getESTDate();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const gamesWithUsers = games.map(g => ({
    ...g,
    homeUser: userMap[g.homeUserId] || null,
    awayUser: g.awayUserId ? userMap[g.awayUserId] : null,
  }));
  
  res.json({ 
    date: scheduler.formatDate(tomorrow),
    games: gamesWithUsers,
  });
});

// Get full schedule
app.get('/api/schedule', authMiddleware, (req, res) => {
  const schedule = scheduler.getScheduleWithDetails();
  res.json(schedule);
});

// Get my upcoming games
app.get('/api/schedule/my-games', authMiddleware, (req, res) => {
  const schedule = scheduler.loadSchedule();
  const users = db.getAllUsers();
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  
  const myGames = schedule.games
    .filter(g => g.homeUserId === req.user.id || g.awayUserId === req.user.id)
    .map(g => ({
      ...g,
      homeUser: userMap[g.homeUserId] || null,
      awayUser: g.awayUserId ? userMap[g.awayUserId] : null,
      isHome: g.homeUserId === req.user.id,
    }));
  
  res.json({ games: myGames });
});

// Admin: Initialize/reset schedule (for testing)
app.post('/api/schedule/init', authMiddleware, (req, res) => {
  const { reset } = req.body;
  const schedule = scheduler.initializeSchedule(reset === true);
  res.json({ 
    message: reset ? 'Schedule reset' : 'Schedule initialized',
    seasonStart: schedule.seasonStart,
    totalGames: schedule.games.length,
  });
});

// Admin: Run pending games now (for testing)
app.post('/api/schedule/run-now', authMiddleware, (req, res) => {
  const results = scheduler.runPendingGames();
  res.json({ 
    message: `Ran ${results.length} games`,
    results,
  });
});

// =============================================================================
// MINTING STATS
// =============================================================================

app.get('/api/minting/stats', authMiddleware, (req, res) => {
  const stats = mintingLedger.getAvailabilityStats();
  res.json(stats);
});

// =============================================================================
// HEALTH CHECK (for Render)
// =============================================================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

app.get('/', (req, res) => {
  res.json({ 
    name: 'First & 10 API',
    version: '1.0.0',
    status: 'running',
  });
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(PORT, '0.0.0.0', () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║             First & 10 - API Server                        ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                              ║
║  Environment: ${(isProduction ? 'PRODUCTION' : 'development').padEnd(14)}                       ║
║                                                           ║
║  API Endpoints:                                           ║
║    POST /api/auth/register    - Create account            ║
║    POST /api/auth/login       - Login                     ║
║    POST /api/packs/open       - Open a pack               ║
║    GET  /api/cards            - View your cards           ║
║    GET  /api/roster           - View your roster          ║
║    PUT  /api/roster           - Update roster             ║
║    GET  /api/schedule/today   - Today's games             ║
║    GET  /api/schedule/tomorrow - Tomorrow's games         ║
║    GET  /api/leaderboard      - View standings            ║
║                                                           ║
║  Game Times: 7:00 PM & 9:00 PM EST (auto-played)          ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  // Pre-load players
  packs.loadPlayers();
  
  // Start the game scheduler
  scheduler.startScheduler();
});
