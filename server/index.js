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
const messages = require('./messages');

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

// Serve card images - check persistent storage FIRST, then fall back to public
const PERSISTENT_DIR = '/var/data';
const fs = require('fs');
if (fs.existsSync(PERSISTENT_DIR)) {
  // Ensure the cards directory exists in persistent storage
  const persistentCardsDir = path.join(PERSISTENT_DIR, 'cards');
  if (!fs.existsSync(persistentCardsDir)) {
    fs.mkdirSync(persistentCardsDir, { recursive: true });
  }
  
  // Custom middleware to serve cards from persistent OR public
  app.use('/cards', (req, res, next) => {
    const filename = req.path.replace(/^\//, ''); // Remove leading slash
    const persistentPath = path.join(PERSISTENT_DIR, 'cards', filename);
    const publicPath = path.join(__dirname, '../public/cards', filename);
    
    // Check persistent storage first
    if (fs.existsSync(persistentPath)) {
      return res.sendFile(persistentPath);
    }
    // Fall back to public folder (for placeholder.svg, etc.)
    if (fs.existsSync(publicPath)) {
      return res.sendFile(publicPath);
    }
    // Not found
    next();
  });
  console.log('Serving card images from persistent storage with public fallback');
} else {
  // Development: just serve from public
  app.use('/cards', express.static(path.join(__dirname, '../public/cards')));
}

// Serve other static files from public
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

// Check if username exists or is pre-registered
app.get('/api/auth/check/:username', (req, res) => {
  const username = req.params.username;
  
  const existingUser = db.getUserByUsername(username);
  if (existingUser) {
    return res.json({ status: 'exists', message: 'Username already registered. Please login.' });
  }
  
  const preregistered = db.getPreregisteredUser(username);
  if (preregistered) {
    return res.json({ 
      status: 'preregistered', 
      message: 'Welcome! Set your password and team name to get started.',
      maxPacks: preregistered.max_packs,
    });
  }
  
  return res.json({ status: 'not_found', message: 'Username not found. Contact admin for access.' });
});

// Register (for open registration - disabled for invite-only)
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, teamName } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    
    // Check if pre-registered (use claim flow)
    const preregistered = db.getPreregisteredUser(username);
    if (preregistered) {
      const user = db.claimPreregisteredUser(username, password, teamName);
      const token = generateToken();
      sessions.set(token, user);
      return res.json({ user, token, claimed: true });
    }
    
    // For now, require pre-registration (invite-only MVP)
    return res.status(403).json({ 
      error: 'Registration is invite-only. Contact admin for access.' 
    });
    
    // Uncomment below for open registration:
    // const user = db.createUser(username, password, teamName);
    // const token = generateToken();
    // sessions.set(token, user);
    // res.json({ user, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password, teamName } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Check if this is a pre-registered user claiming their account
    const preregistered = db.getPreregisteredUser(username);
    if (preregistered) {
      // This is their first login - set password and create account
      const user = db.claimPreregisteredUser(username, password, teamName);
      const token = generateToken();
      sessions.set(token, user);
      return res.json({ user, token, firstLogin: true });
    }
    
    // Regular login
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

// Update team name
app.put('/api/auth/team-name', authMiddleware, (req, res) => {
  try {
    const { teamName } = req.body;
    const user = db.updateTeamName(req.user.id, teamName);
    res.json({ success: true, team_name: user.team_name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================================
// ADMIN ROUTES (for pre-registration)
// =============================================================================

const ADMIN_KEY = process.env.ADMIN_KEY || 'first10admin2024';

function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Pre-register a username
app.post('/api/admin/preregister', adminAuth, (req, res) => {
  try {
    const { username, maxPacks } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    
    const preUser = db.preregisterUser(username, maxPacks || 8);
    res.json({ success: true, user: preUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List all pre-registered users
app.get('/api/admin/preregistered', adminAuth, (req, res) => {
  const list = db.listPreregistered();
  res.json({ preregistered: list });
});

// Update user's max packs
app.put('/api/admin/user/:userId/packs', adminAuth, (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { maxPacks } = req.body;
    const user = db.updateUserMaxPacks(userId, maxPacks);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List all users (admin)
app.get('/api/admin/users', adminAuth, (req, res) => {
  const users = db.getAllUsers();
  res.json({ users: users.map(u => ({
    id: u.id,
    username: u.username,
    team_name: u.team_name,
    packs_opened: u.packs_opened,
    max_packs: u.max_packs,
    created_at: u.created_at,
  }))});
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

// Check if AI image generation is enabled
const AI_ENABLED = !!process.env.OPENAI_API_KEY;

// Open a pack
app.post('/api/packs/open', authMiddleware, async (req, res) => {
  try {
    const user = db.getUser(req.user.id);
    
    if (user.packs_opened >= user.max_packs) {
      return res.status(400).json({ error: 'No packs remaining' });
    }
    
    // Determine pack type
    const isStarterPack = user.packs_opened < 3; // First 3 are starter packs
    const cards = isStarterPack ? packs.openStarterPack(user.packs_opened) : packs.openPack();
    
    if (cards.length === 0) {
      return res.status(400).json({ error: 'No cards available to mint' });
    }
    
    // Save cards to database AND mint them (mark as taken)
    const savedCards = [];
    const cardsToGenerateImages = [];
    
    for (const card of cards) {
      // Mint the card (mark as taken in ledger)
      try {
        mintingLedger.mintCard(card, req.user.id);
      } catch (mintErr) {
        console.error('Mint error (skipping):', mintErr.message);
        continue; // Skip if already minted somehow
      }
      
      // Get formatted stats for card back
      card.stats = cardImageGenerator.getFormattedStats(card);
      
      // Use placeholder image initially if AI is enabled
      // For SVG (non-AI), generate immediately since it's fast
      let imageUrl;
      let imagePending = false;
      
      if (AI_ENABLED) {
        // Use a placeholder, generate AI image in background
        imageUrl = '/cards/placeholder.svg';
        imagePending = true;
      } else {
        // SVG is instant, generate now
        imageUrl = await cardImageGenerator.getOrGenerateCardImage(card);
      }
      
      card.image_url = imageUrl;
      card.image_pending = imagePending;
      
      const cardId = db.addCard(req.user.id, card);
      const savedCard = { id: cardId, ...card, image_url: imageUrl, image_pending: imagePending };
      savedCards.push(savedCard);
      
      if (imagePending) {
        cardsToGenerateImages.push({ cardId, card: savedCard });
      }
    }
    
    // Increment packs opened
    db.incrementPacksOpened(req.user.id);
    
    // Generate AI images in background (don't wait)
    if (cardsToGenerateImages.length > 0) {
      setImmediate(async () => {
        for (const { cardId, card } of cardsToGenerateImages) {
          try {
            console.log(`Background: Generating AI image for card ${cardId}...`);
            const imageUrl = await cardImageGenerator.getOrGenerateCardImage(card);
            db.updateCardImage(cardId, imageUrl);
            console.log(`Background: Card ${cardId} image ready: ${imageUrl}`);
          } catch (err) {
            console.error(`Background: Failed to generate image for card ${cardId}:`, err.message);
          }
        }
      });
    }
    
    res.json({
      packType: isStarterPack ? 'starter' : 'bonus',
      packNumber: user.packs_opened + 1,
      cards: savedCards,
      packsRemaining: user.max_packs - user.packs_opened - 1,
      imagesGenerating: AI_ENABLED, // Tell frontend images are being generated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Open all remaining packs at once
app.post('/api/packs/open-all', authMiddleware, async (req, res) => {
  try {
    const user = db.getUser(req.user.id);
    const remaining = user.max_packs - user.packs_opened;
    
    if (remaining <= 0) {
      return res.status(400).json({ error: 'No packs remaining' });
    }
    
    const allCards = [];
    const cardsToGenerateImages = [];
    
    for (let i = 0; i < remaining; i++) {
      const currentPackNum = user.packs_opened + i;
      const isStarterPack = currentPackNum < 3;
      const cards = isStarterPack ? packs.openStarterPack(currentPackNum) : packs.openPack();
      
      for (const card of cards) {
        // Mint the card (mark as taken in ledger)
        try {
          mintingLedger.mintCard(card, req.user.id);
        } catch (mintErr) {
          console.error('Mint error (skipping):', mintErr.message);
          continue;
        }
        
        // Get formatted stats for card back
        card.stats = cardImageGenerator.getFormattedStats(card);
        
        // Use placeholder image initially if AI is enabled
        let imageUrl;
        let imagePending = false;
        
        if (AI_ENABLED) {
          imageUrl = '/cards/placeholder.svg';
          imagePending = true;
        } else {
          imageUrl = await cardImageGenerator.getOrGenerateCardImage(card);
        }
        
        card.image_url = imageUrl;
        card.image_pending = imagePending;
        
        const cardId = db.addCard(req.user.id, card);
        const savedCard = { 
          id: cardId, 
          ...card,
          image_url: imageUrl,
          image_pending: imagePending,
          packNumber: currentPackNum + 1,
          packType: isStarterPack ? 'starter' : 'bonus'
        };
        allCards.push(savedCard);
        
        if (imagePending) {
          cardsToGenerateImages.push({ cardId, card: savedCard });
        }
      }
      
      db.incrementPacksOpened(req.user.id);
    }
    
    // Generate AI images in background (don't wait)
    if (cardsToGenerateImages.length > 0) {
      setImmediate(async () => {
        for (const { cardId, card } of cardsToGenerateImages) {
          try {
            console.log(`Background: Generating AI image for card ${cardId}...`);
            const imageUrl = await cardImageGenerator.getOrGenerateCardImage(card);
            db.updateCardImage(cardId, imageUrl);
            console.log(`Background: Card ${cardId} image ready: ${imageUrl}`);
          } catch (err) {
            console.error(`Background: Failed to generate image for card ${cardId}:`, err.message);
          }
        }
      });
    }
    
    res.json({
      packsOpened: remaining,
      totalCards: allCards.length,
      cards: allCards,
      packsRemaining: 0,
      imagesGenerating: AI_ENABLED,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// CARD ROUTES
// =============================================================================

// Helper: Check if card needs image regeneration
function cardNeedsImage(card) {
  // No image URL at all
  if (!card.image_url) {
    console.log(`Card ${card.id} needs image: no image_url`);
    return true;
  }
  
  // Has placeholder image
  if (card.image_url.includes('placeholder')) {
    console.log(`Card ${card.id} needs image: has placeholder`);
    return true;
  }
  
  // SVG = fallback, needs AI regeneration to get PNG
  if (card.image_url.endsWith('.svg')) {
    console.log(`Card ${card.id} needs image: has SVG fallback, needs AI PNG`);
    return true;
  }
  
  // Marked as pending
  if (card.image_pending) {
    console.log(`Card ${card.id} needs image: image_pending is true`);
    return true;
  }
  
  // Check if PNG file actually exists
  const fs = require('fs');
  const path = require('path');
  const PERSISTENT_DIR = '/var/data';
  const USE_PERSISTENT = fs.existsSync(PERSISTENT_DIR);
  const filename = card.image_url.split('/').pop();
  
  // Check persistent storage first
  if (USE_PERSISTENT) {
    const persistentPath = path.join(PERSISTENT_DIR, 'cards', filename);
    if (fs.existsSync(persistentPath)) {
      return false; // PNG exists
    }
  }
  
  // Check public folder as fallback
  const publicPath = path.join(__dirname, '../public/cards', filename);
  if (fs.existsSync(publicPath)) {
    return false; // PNG exists
  }
  
  console.log(`Card ${card.id} needs image: PNG file not found (${filename})`);
  return true;
}

// Helper: Regenerate image for a card in background
function regenerateCardImage(cardId, card) {
  setImmediate(async () => {
    try {
      // Convert database card format to player format expected by image generator
      const playerData = {
        player: card.player_name || card.player || 'Unknown',
        player_name: card.player_name || card.player || 'Unknown',
        season: card.season,
        team: card.team,
        position: card.position,
        tier: card.tier,
        composite_score: card.composite_score,
        // Include raw stat fields if available for proper formatting
        ...card,
      };
      
      console.log(`Regenerating image for card ${cardId} (${playerData.player}, ${playerData.season})...`);
      
      // Force regeneration by not using cache
      const imageUrl = await cardImageGenerator.generateAICard(playerData);
      
      if (imageUrl && !imageUrl.includes('placeholder')) {
        db.updateCardImage(cardId, imageUrl);
        console.log(`Card ${cardId} image regenerated successfully: ${imageUrl}`);
      } else {
        console.log(`Card ${cardId} regeneration returned placeholder, skipping update`);
      }
    } catch (err) {
      console.error(`Failed to regenerate image for card ${cardId}:`, err.message);
    }
  });
}

// Get all user's cards
app.get('/api/cards', authMiddleware, (req, res) => {
  const cards = db.getUserCards(req.user.id);
  
  // Check for cards needing image regeneration
  if (AI_ENABLED) {
    for (const card of cards) {
      if (cardNeedsImage(card)) {
        regenerateCardImage(card.id, card);
      }
    }
  }
  
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
// VIEW OTHER USERS' COLLECTIONS
// =============================================================================

// Get all users with their card counts (for browsing)
app.get('/api/users', authMiddleware, (req, res) => {
  const users = db.getAllUsers();
  const userList = users.map(u => {
    const cards = db.getUserCards(u.id);
    const stats = db.getUserStats(u.id);
    return {
      id: u.id,
      username: u.username,
      team_name: u.team_name,
      card_count: cards.length,
      stats,
    };
  });
  res.json({ users: userList });
});

// Get another user's card collection
app.get('/api/users/:userId/cards', authMiddleware, (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = db.getUser(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const cards = db.getUserCards(userId);
  
  // Check for cards needing image regeneration
  if (AI_ENABLED) {
    for (const card of cards) {
      if (cardNeedsImage(card)) {
        regenerateCardImage(card.id, card);
      }
    }
  }
  
  res.json({ 
    user: {
      id: user.id,
      username: user.username,
      team_name: user.team_name,
    },
    cards,
    count: cards.length,
  });
});

// Get another user's roster
app.get('/api/users/:userId/roster', authMiddleware, (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = db.getUser(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const fullRoster = db.getFullRoster(userId);
  
  res.json({
    user: {
      id: user.id,
      username: user.username,
      team_name: user.team_name,
    },
    roster: fullRoster,
  });
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
// DIRECT MESSAGES
// =============================================================================

// Get unread message count
app.get('/api/messages/unread-count', authMiddleware, (req, res) => {
  const count = messages.getUnreadCount(req.user.id);
  res.json({ count });
});

// Get inbox (received messages)
app.get('/api/messages/inbox', authMiddleware, (req, res) => {
  const inbox = messages.getInbox(req.user.id);
  
  // Enrich with sender info
  const enriched = inbox.map(msg => {
    const sender = db.getUser(msg.from_user_id);
    return {
      ...msg,
      from_username: sender?.username || 'Unknown',
      from_team_name: sender?.team_name || 'Unknown Team',
    };
  });
  
  res.json({ messages: enriched });
});

// Get conversation with a user
app.get('/api/messages/conversation/:userId', authMiddleware, (req, res) => {
  const otherUserId = parseInt(req.params.userId);
  const conversation = messages.getConversation(req.user.id, otherUserId);
  
  // Mark messages from other user as read
  messages.markAsRead(req.user.id, otherUserId);
  
  // Enrich with user info
  const otherUser = db.getUser(otherUserId);
  const enriched = conversation.map(msg => ({
    ...msg,
    is_mine: msg.from_user_id === req.user.id,
  }));
  
  res.json({ 
    messages: enriched,
    other_user: {
      id: otherUser?.id,
      username: otherUser?.username,
      team_name: otherUser?.team_name,
    },
  });
});

// Send a message
app.post('/api/messages/send', authMiddleware, (req, res) => {
  try {
    const { to_user_id, content } = req.body;
    
    if (!to_user_id || !content) {
      return res.status(400).json({ error: 'Missing to_user_id or content' });
    }
    
    // Verify recipient exists
    const recipient = db.getUser(parseInt(to_user_id));
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    const message = messages.sendMessage(req.user.id, parseInt(to_user_id), content);
    
    res.json({ 
      success: true, 
      message: {
        ...message,
        to_username: recipient.username,
        to_team_name: recipient.team_name,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================================
// ADMIN: Debug card images
// =============================================================================

// Admin: Update user's max packs
app.post('/api/admin/add-packs', (req, res) => {
  try {
    const { username, packs_to_add } = req.body;
    
    if (!username || !packs_to_add) {
      return res.status(400).json({ error: 'Missing username or packs_to_add' });
    }
    
    const user = db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: `User "${username}" not found` });
    }
    
    const newMax = user.max_packs + parseInt(packs_to_add);
    db.updateUserMaxPacks(user.id, newMax);
    
    res.json({ 
      success: true,
      username,
      old_max: user.max_packs,
      new_max: newMax,
      packs_remaining: newMax - user.packs_opened,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint to see card image status (no auth for easy debugging)
app.get('/api/admin/debug-images', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  const PERSISTENT_DIR = '/var/data';
  const USE_PERSISTENT = fs.existsSync(PERSISTENT_DIR);
  
  const allUsers = db.getAllUsers();
  const results = [];
  
  for (const user of allUsers) {
    const cards = db.getUserCards(user.id);
    for (const card of cards) {
      const filename = card.image_url ? card.image_url.split('/').pop() : null;
      
      let fileStatus = 'no_url';
      if (filename) {
        const persistentPath = path.join(PERSISTENT_DIR, 'cards', filename);
        const publicPath = path.join(__dirname, '../public/cards', filename);
        
        if (USE_PERSISTENT && fs.existsSync(persistentPath)) {
          fileStatus = 'exists_persistent';
        } else if (fs.existsSync(publicPath)) {
          fileStatus = 'exists_public';
        } else {
          fileStatus = 'file_missing';
        }
      }
      
      results.push({
        id: card.id,
        player: card.player_name,
        season: card.season,
        image_url: card.image_url,
        image_pending: card.image_pending,
        file_status: fileStatus,
        needs_regen: cardNeedsImage(card),
      });
    }
  }
  
  res.json({
    persistent_storage: USE_PERSISTENT,
    persistent_dir: PERSISTENT_DIR,
    total_cards: results.length,
    missing: results.filter(r => r.file_status === 'file_missing' || r.file_status === 'no_url').length,
    cards: results,
  });
});

// =============================================================================
// ADMIN: Regenerate missing images
// =============================================================================

app.post('/api/admin/regenerate-images', (req, res) => {
  if (!AI_ENABLED) {
    return res.status(400).json({ error: 'AI image generation not enabled (no OPENAI_API_KEY)' });
  }
  
  // Get all cards from all users
  const allUsers = db.getAllUsers();
  let cardsToRegenerate = [];
  
  for (const user of allUsers) {
    const cards = db.getUserCards(user.id);
    for (const card of cards) {
      if (cardNeedsImage(card)) {
        cardsToRegenerate.push(card);
      }
    }
  }
  
  // Trigger regeneration for all missing images
  for (const card of cardsToRegenerate) {
    regenerateCardImage(card.id, card);
  }
  
  res.json({ 
    message: `Regenerating images for ${cardsToRegenerate.length} cards`,
    cards: cardsToRegenerate.map(c => ({ id: c.id, player: c.player || c.player_name })),
  });
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
