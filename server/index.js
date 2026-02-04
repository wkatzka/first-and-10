/**
 * First & 10 - API Server
 * ===========================
 * Express server for the MVP web app. Uses Postgres when DATABASE_URL is set.
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./database');
const dbPool = require('./db');
const packs = require('./packs');
const gameEngine = require('./game-bridge');
const mintingLedger = require('./minting-ledger');
const scheduler = require('./scheduler');
const cardImageGenerator = require('./card-image-generator');
const pressConference = require('./press-conference');
const messages = require('./messages');
const imageRegenQueue = require('./image-regen-queue');
const { buildEngineForCard } = require('./game-engine/player-traits');
let packFulfillment;
try {
  packFulfillment = require('./pack-fulfillment');
} catch (e) {
  packFulfillment = {
    start: () => Promise.resolve(),
    getPackStatus: () => Promise.resolve(null),
    getPacksForWallet: () => Promise.resolve([]),
    pollForEvents: () => Promise.resolve(),
  };
}

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  process.env.FRONTEND_URL,
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

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const session = await db.getSession(token);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    req.user = { id: session.user_id, username: session.username, team_name: session.team_name };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Admin auth (for safe production DB inspection)
function adminMiddleware(req, res, next) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_KEY not configured on server' });
  }

  const provided = req.headers['x-admin-key'];
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

async function findUserCaseInsensitive(username) {
  if (dbPool.useDatabase()) return await db.getUserByUsernameCaseInsensitive(username);
  const raw = await db.getDb();
  const needle = String(username || '').toLowerCase();
  return raw.users.find(u => String(u.username || '').toLowerCase() === needle) || null;
}

async function getRosterStatus(userId) {
  const required = [
    'qb_card_id', 'rb_card_id',
    'wr1_card_id', 'wr2_card_id', 'te_card_id',
    'ol_card_id', 'dl_card_id', 'lb_card_id',
    'db1_card_id', 'db2_card_id',
    'k_card_id',
  ];
  const full = await db.getFullRoster(userId);
  const roster = full?.roster || null;
  const cards = full?.cards || {};
  const missingSlots = [];
  for (const key of required) {
    const cardId = roster?.[key];
    const card = cards?.[key];
    if (!cardId || !card) missingSlots.push(key);
  }
  return { fullRoster: missingSlots.length === 0, missingSlots, roster };
}

// =============================================================================
// ADMIN (read-only)
// =============================================================================

// Look up a user by username (case-insensitive) and roster status
app.get('/api/admin/user', adminMiddleware, async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'username query param required' });
  const user = await findUserCaseInsensitive(username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const raw = await db.getDb();
  const cardCount = dbPool.useDatabase() ? (await db.getUserCards(user.id)).length : raw.cards.filter(c => c.user_id === user.id).length;
  const rosterStatus = await getRosterStatus(user.id);
  res.json({
    user: { id: user.id, username: user.username, team_name: user.team_name, created_at: user.created_at, packs_opened: user.packs_opened, max_packs: user.max_packs, card_count: cardCount },
    roster: rosterStatus.roster,
    rosterStatus: { fullRoster: rosterStatus.fullRoster, missingSlots: rosterStatus.missingSlots },
  });
});

// Convenience endpoint: just whether they have a full roster
app.get('/api/admin/has-full-roster', adminMiddleware, async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: 'username query param required' });
  const user = await findUserCaseInsensitive(username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const rosterStatus = await getRosterStatus(user.id);
  res.json({ username: user.username, userId: user.id, fullRoster: rosterStatus.fullRoster, missingSlots: rosterStatus.missingSlots });
});

// =============================================================================
// AUTH ROUTES
// =============================================================================

// Check if username exists or is pre-registered
app.get('/api/auth/check/:username', async (req, res, next) => {
  try {
    const username = req.params.username;

    const existingUser = await db.getUserByUsernameCaseInsensitive(username);
    if (existingUser) {
      return res.json({ status: 'exists', message: 'Username already registered. Please login.' });
    }

    const preregistered = await db.getPreregisteredUser(username);
    if (preregistered) {
      return res.json({
        status: 'preregistered',
        message: 'Welcome! Set your password and team name to get started.',
        maxPacks: preregistered.max_packs,
      });
    }

    return res.json({ status: 'not_found', message: 'Username not found. Contact admin for access.' });
  } catch (err) {
    const msg = (err && (err.message || String(err))) || 'Failed to check username';
    console.error('GET /api/auth/check error:', err);
    if (!res.headersSent) return res.status(500).json({ error: msg });
    next(err);
  }
});

// Register (for open registration - disabled for invite-only)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, teamName } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    const preregistered = await db.getPreregisteredUser(username);
    if (preregistered) {
      const user = await db.claimPreregisteredUser(username, password, teamName);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const token = await db.createSession(user.id, user.username, user.team_name, expiresAt);
      return res.json({ user: { id: user.id, username: user.username, team_name: user.team_name }, token, claimed: true });
    }
    return res.status(403).json({ error: 'Registration is invite-only. Contact admin for access.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { username, password, teamName } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    // If user already exists in users, always authenticate (never claim again)
    const existingUser = await db.getUserByUsernameCaseInsensitive(username);
    if (existingUser) {
      const user = await db.authenticateUser(username, password);
      const full = await db.getUser(user.id);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const token = await db.createSession(user.id, user.username, full?.team_name, expiresAt);
      return res.json({ user: { id: user.id, username: user.username, team_name: full?.team_name, packs_opened: user.packs_opened, max_packs: user.max_packs }, token });
    }
    const preregistered = await db.getPreregisteredUser(username);
    if (preregistered) {
      try {
        const user = await db.claimPreregisteredUser(username, password, teamName);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const token = await db.createSession(user.id, user.username, user.team_name, expiresAt);
        return res.json({ user: { id: user.id, username: user.username, team_name: user.team_name }, token, firstLogin: true });
      } catch (claimErr) {
        try {
          const user = await db.authenticateUser(username, password);
          const full = await db.getUser(user.id);
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const token = await db.createSession(user.id, user.username, full?.team_name, expiresAt);
          return res.json({ user: { id: user.id, username: user.username, team_name: full?.team_name, packs_opened: user.packs_opened, max_packs: user.max_packs }, token });
        } catch (_) {
          throw claimErr;
        }
      }
    }
    return res.status(401).json({ error: 'Invalid username or password' });
  } catch (err) {
    const msg = (err && (err.message || String(err))) || 'Login failed';
    const isAuthError = /invalid|password|not found|required/i.test(msg);
    if (!res.headersSent) {
      if (isAuthError) return res.status(401).json({ error: msg });
      console.error('POST /api/auth/login error:', err);
      return res.status(500).json({ error: msg });
    }
    next(err);
  }
});

// Logout
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  await db.deleteSession(token);
  res.json({ success: true });
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await db.getUser(req.user.id);
  const stats = await db.getUserStats(req.user.id);
  res.json({ user, stats });
});

// Update team name
app.put('/api/auth/team-name', authMiddleware, async (req, res) => {
  try {
    const { teamName } = req.body;
    const user = await db.updateTeamName(req.user.id, teamName);
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
app.post('/api/admin/preregister', adminAuth, async (req, res) => {
  try {
    const { username, maxPacks } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    
    const preUser = await db.preregisterUser(username, maxPacks || 8);
    res.json({ success: true, user: preUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List all pre-registered users
app.get('/api/admin/preregistered', adminAuth, async (req, res) => {
  const list = await db.listPreregistered();
  res.json({ preregistered: list });
});

// Update user's max packs
app.put('/api/admin/user/:userId/packs', adminAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { maxPacks } = req.body;
    const user = await db.updateUserMaxPacks(userId, maxPacks);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reset a user's password (admin). Sets a temporary password so they can log in and change it later.
app.post('/api/admin/reset-password', adminAuth, async (req, res) => {
  try {
    const { username, tempPassword } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const password = tempPassword && tempPassword.length >= 4 ? tempPassword : 'password';
    const user = await db.setPasswordByUsername(username, password);
    res.json({
      success: true,
      message: `Password for ${user.username} has been reset.`,
      username: user.username,
      tempPassword: password,
    });
  } catch (err) {
    if (err.message === 'User not found') return res.status(404).json({ error: err.message });
    res.status(400).json({ error: err.message });
  }
});

// List all users (admin)
app.get('/api/admin/users', adminAuth, async (req, res) => {
  const users = await db.getAllUsers();
  res.json({ users: users.map(u => ({
    id: u.id,
    username: u.username,
    team_name: u.team_name,
    packs_opened: u.packs_opened,
    max_packs: u.max_packs,
    created_at: u.created_at,
  }))});
});

// Admin: Card counts & image health per user
app.get('/api/admin/user-card-stats', adminAuth, async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const PERSISTENT_DIR = '/var/data';
  const USE_PERSISTENT = fs.existsSync(PERSISTENT_DIR);
  const publicCardsDir = path.join(__dirname, '../public/cards');
  const persistentCardsDir = path.join(PERSISTENT_DIR, 'cards');
  
  function fileStatusForUrl(imageUrl) {
    if (!imageUrl) return 'no_url';
    const filename = imageUrl.split('/').pop();
    if (!filename) return 'no_url';
    if (USE_PERSISTENT) {
      const p = path.join(persistentCardsDir, filename);
      if (fs.existsSync(p)) return 'exists_persistent';
    }
    const pub = path.join(publicCardsDir, filename);
    if (fs.existsSync(pub)) return 'exists_public';
    return 'file_missing';
  }
  
  // Same logic as cardNeedsImage, but without noisy logs
  function needsRegen(card) {
    const u = card.image_url || '';
    if (!u) return true;
    if (u.includes('placeholder')) return true;
    if (u.endsWith('.svg')) return true;
    if (card.image_pending) return true;
    // If it's a png, ensure the file exists
    if (u.endsWith('.png')) {
      return fileStatusForUrl(u) === 'file_missing';
    }
    return false;
  }
  
  const users = await db.getAllUsers();
  const results = await Promise.all(users.map(async (u) => {
    const cards = await db.getUserCards(u.id);
    const stats = {
      user_id: u.id,
      username: u.username,
      team_name: u.team_name,
      packs_opened: u.packs_opened,
      max_packs: u.max_packs,
      card_count: cards.length,
      image: {
        png: 0,
        svg: 0,
        placeholder: 0,
        no_url: 0,
        pending_true: 0,
        file_missing: 0,
        needs_regen: 0,
      },
    };
    
    for (const c of cards) {
      const url = c.image_url || '';
      if (!url) stats.image.no_url++;
      if (url.endsWith('.png')) stats.image.png++;
      if (url.endsWith('.svg')) stats.image.svg++;
      if (url.includes('placeholder')) stats.image.placeholder++;
      if (c.image_pending) stats.image.pending_true++;
      if (fileStatusForUrl(url) === 'file_missing') stats.image.file_missing++;
      if (needsRegen(c)) stats.image.needs_regen++;
    }
    
    return stats;
  }));
  
  res.json({
    persistent_storage: USE_PERSISTENT,
    users: results,
  });
});

// Admin: Compensate a user for missing mints by adding bonus packs
// If pack opens were counted but fewer than 5 cards were saved, this restores fairness
app.post('/api/admin/compensate-missing-packs', adminAuth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Missing username' });
    }
    
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: `User "${username}" not found` });
    }
    
    const actualCards = (await db.getUserCards(user.id)).length;
    const expectedCards = (user.packs_opened || 0) * 5;
    const missingCards = Math.max(0, expectedCards - actualCards);
    
    if (missingCards === 0) {
      return res.json({
        success: true,
        username,
        expectedCards,
        actualCards,
        missingCards,
        packsAdded: 0,
        newMaxPacks: user.max_packs,
      });
    }
    
    const packsToAdd = Math.ceil(missingCards / 5);
    const newMax = (user.max_packs || 0) + packsToAdd;
    await db.updateUserMaxPacks(user.id, newMax);
    
    res.json({
      success: true,
      username,
      expectedCards,
      actualCards,
      missingCards,
      packsAdded: packsToAdd,
      newMaxPacks: newMax,
      packsRemaining: newMax - (user.packs_opened || 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// PACK ROUTES
// =============================================================================

// Get pack info
const STARTER_PACKS_MAX = 3;
app.get('/api/packs/info', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUser(req.user.id);
    const packStats = packs.getPackStats();
    const availability = mintingLedger.getAvailabilityStats();
    const opened = user.packs_opened ?? 0;
    const maxPacks = user.max_packs ?? 13;
    const starterOpened = Math.min(opened, STARTER_PACKS_MAX);
    const bonusMax = Math.max(0, maxPacks - STARTER_PACKS_MAX);
    const bonusOpened = Math.max(0, opened - STARTER_PACKS_MAX);

    res.json({
      packsOpened: opened,
      maxPacks,
      packsRemaining: maxPacks - opened,
      starterPacksOpened: starterOpened,
      starterPacksMax: STARTER_PACKS_MAX,
      bonusPacksOpened: bonusOpened,
      bonusPacksMax: bonusMax,
      tierRates: packStats.expectedRates,
      cardAvailability: availability,
    });
  } catch (err) {
    console.error('GET /api/packs/info error:', err);
    res.status(500).json({ error: err.message || 'Failed to load pack info' });
  }
});

// Check if AI image generation is enabled
const AI_ENABLED = !!process.env.OPENAI_API_KEY;

// Start rate-limited image regen queue (prevents OpenAI IPM bursts)
if (AI_ENABLED) {
  imageRegenQueue.start({ db, cardImageGenerator });
}

// Open a pack
app.post('/api/packs/open', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUser(req.user.id);
    
    if (user.packs_opened >= user.max_packs) {
      return res.status(400).json({ error: 'No packs remaining' });
    }
    
    // Determine pack type
    const isStarterPack = user.packs_opened < 3; // First 3 are starter packs
    const packNum = user.packs_opened; // 0-based
    const cards = isStarterPack ? await packs.openStarterPack(packNum) : await packs.openPack();
    
    if (cards.length === 0) {
      return res.status(400).json({ error: 'No cards available to mint' });
    }
    
    // Sneak a Hall of Fame card into one pack for John!
    const isJohn = user.username && String(user.username).toLowerCase() === 'john!';
    let hofForSlot = null;
    let hofSlotIndex = 2;
    if (isJohn) {
      for (let a = 0; a < 50; a++) {
        const p = await packs.pickRandomPlayerFromTier(11);
        if (p && (p.tier === 11 || p.isHOF) && !(await mintingLedger.isCardMinted(p))) {
          hofForSlot = p;
          hofSlotIndex = Math.floor(Math.random() * 5);
          break;
        }
      }
    }
    
    // Save cards to database AND mint them (mark as taken)
    const savedCards = [];
    const cardsToGenerateImages = [];
    const desiredCount = 5;
    const desiredPositions = cards.slice(0, desiredCount).map(c => c.position);
    
    for (let i = 0; i < desiredCount; i++) {
      const preferredPosition = desiredPositions[i] || null;
      let mintedCard = null;
      const useHofThisSlot = isJohn && i === hofSlotIndex && hofForSlot;
      
      // Try the originally selected card first, then retry with replacements (or HOF for John!'s special slot)
      for (let attempt = 0; attempt < 200; attempt++) {
        let candidate;
        if (useHofThisSlot && attempt === 0) {
          candidate = hofForSlot;
        } else if (attempt === 0) {
          candidate = cards[i];
        } else {
          candidate = preferredPosition
            ? (packs.pickRandomPlayerFromPosition(preferredPosition) || packs.pickAnyAvailablePlayer())
            : packs.pickAnyAvailablePlayer();
        }
        
        if (!candidate) break;
        
        try {
          mintingLedger.mintCard(candidate, req.user.id);
          mintedCard = { ...candidate };
          break;
        } catch (mintErr) {
          // Collision/race: try another card instead of skipping
          continue;
        }
      }
      
      if (!mintedCard) {
        return res.status(500).json({ error: 'Could not mint a full pack. Please try again.' });
      }
      
      // Attach stat-derived engine traits (for UI + simulation nuance)
      const engine = buildEngineForCard({
        player_name: mintedCard.player || mintedCard.player_name,
        season: mintedCard.season,
        position: mintedCard.position,
        tier: mintedCard.tier,
        composite_score: mintedCard.composite_score,
      });
      if (engine) {
        mintedCard.engine_v = engine.engine_v;
        mintedCard.engine_era = engine.engine_era;
        mintedCard.engine_percentiles = engine.engine_percentiles;
        mintedCard.engine_traits = engine.engine_traits;
        mintedCard.engine_inferred = engine.engine_inferred;
      }

      // Get formatted stats for card back
      mintedCard.stats = cardImageGenerator.getFormattedStats(mintedCard);
      
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
        imageUrl = await cardImageGenerator.getOrGenerateCardImage(mintedCard);
      }
      
      mintedCard.image_url = imageUrl;
      mintedCard.image_pending = imagePending;
      
      const cardId = await db.addCard(req.user.id, mintedCard);
      const savedCard = { id: cardId, ...mintedCard, image_url: imageUrl, image_pending: imagePending };
      savedCards.push(savedCard);
      
      if (imagePending) {
        cardsToGenerateImages.push({ cardId, card: savedCard });
      }
    }
    
    // Increment packs opened ONLY after minting full pack
    await db.incrementPacksOpened(req.user.id);
    
    // Generate AI images in background (don't wait)
    if (cardsToGenerateImages.length > 0) {
      setImmediate(async () => {
        for (const { cardId, card } of cardsToGenerateImages) {
          try {
            console.log(`Background: Generating AI image for card ${cardId}...`);
            const imageUrl = await cardImageGenerator.getOrGenerateCardImage(card);
            await db.updateCardImage(cardId, imageUrl);
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

// Open a single-card pack (for testing foil animation)
app.post('/api/packs/open-single', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUser(req.user.id);
    
    if (user.packs_opened >= user.max_packs) {
      return res.status(400).json({ error: 'No packs remaining' });
    }
    
    const cards = await packs.openSingleCard();
    
    if (cards.length === 0) {
      return res.status(400).json({ error: 'No cards available to mint' });
    }
    
    const savedCards = [];
    const cardsToGenerateImages = [];

    const preferredPosition = cards[0]?.position || null;
    let mintedCard = null;
    for (let attempt = 0; attempt < 200; attempt++) {
      const candidate = attempt === 0
        ? cards[0]
        : (preferredPosition
            ? (packs.pickRandomPlayerFromPosition(preferredPosition) || packs.pickAnyAvailablePlayer())
            : packs.pickAnyAvailablePlayer());
      if (!candidate) break;
      try {
        mintingLedger.mintCard(candidate, req.user.id);
        mintedCard = { ...candidate };
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!mintedCard) {
      return res.status(500).json({ error: 'Could not mint a single-card pack. Please try again.' });
    }
      
    const engine = buildEngineForCard({
      player_name: mintedCard.player || mintedCard.player_name,
      season: mintedCard.season,
      position: mintedCard.position,
      tier: mintedCard.tier,
      composite_score: mintedCard.composite_score,
    });
    if (engine) {
      mintedCard.engine_v = engine.engine_v;
      mintedCard.engine_era = engine.engine_era;
      mintedCard.engine_percentiles = engine.engine_percentiles;
      mintedCard.engine_traits = engine.engine_traits;
      mintedCard.engine_inferred = engine.engine_inferred;
    }

    mintedCard.stats = cardImageGenerator.getFormattedStats(mintedCard);
      
    let imageUrl;
    let imagePending = false;
      
    if (AI_ENABLED) {
      imageUrl = '/cards/placeholder.svg';
      imagePending = true;
    } else {
      imageUrl = await cardImageGenerator.getOrGenerateCardImage(mintedCard);
    }
      
    mintedCard.image_url = imageUrl;
    mintedCard.image_pending = imagePending;
      
    const cardId = await db.addCard(req.user.id, mintedCard);
    const savedCard = { id: cardId, ...mintedCard, image_url: imageUrl, image_pending: imagePending };
    savedCards.push(savedCard);
      
    if (imagePending) {
      cardsToGenerateImages.push({ cardId, card: savedCard });
    }
    
    await db.incrementPacksOpened(req.user.id);
    
    if (cardsToGenerateImages.length > 0) {
      setImmediate(async () => {
        for (const { cardId, card } of cardsToGenerateImages) {
          try {
            console.log(`Background: Generating AI image for card ${cardId}...`);
            const imageUrl = await cardImageGenerator.getOrGenerateCardImage(card);
            await db.updateCardImage(cardId, imageUrl);
            console.log(`Background: Card ${cardId} image ready: ${imageUrl}`);
          } catch (err) {
            console.error(`Background: Failed to generate image for card ${cardId}:`, err.message);
          }
        }
      });
    }
    
    res.json({
      packType: 'bonus',
      packNumber: user.packs_opened + 1,
      cards: savedCards,
      packsRemaining: user.max_packs - user.packs_opened - 1,
      imagesGenerating: AI_ENABLED,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Open all remaining packs at once
app.post('/api/packs/open-all', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUser(req.user.id);
    const remaining = user.max_packs - user.packs_opened;
    
    if (remaining <= 0) {
      return res.status(400).json({ error: 'No packs remaining' });
    }
    
    const allCards = [];
    const cardsToGenerateImages = [];
    
    for (let i = 0; i < remaining; i++) {
      const currentPackNum = user.packs_opened + i;
      const isStarterPack = currentPackNum < 3;
      const cards = isStarterPack ? await packs.openStarterPack(currentPackNum) : await packs.openPack();
      const desiredCount = 5;
      const desiredPositions = cards.slice(0, desiredCount).map(c => c.position);
      let mintedThisPack = 0;
      
      for (let slot = 0; slot < desiredCount; slot++) {
        const preferredPosition = desiredPositions[slot] || null;
        let mintedCard = null;
        
        for (let attempt = 0; attempt < 200; attempt++) {
          const candidate = attempt === 0
            ? cards[slot]
            : (preferredPosition
                ? (packs.pickRandomPlayerFromPosition(preferredPosition) || packs.pickAnyAvailablePlayer())
                : packs.pickAnyAvailablePlayer());
          if (!candidate) break;
          try {
            mintingLedger.mintCard(candidate, req.user.id);
            mintedCard = { ...candidate };
            break;
          } catch (e) {
            continue;
          }
        }
        
        if (!mintedCard) {
          return res.status(500).json({ error: 'Could not mint all packs due to mint collisions. Please try again.' });
        }
        
        const engine = buildEngineForCard({
          player_name: mintedCard.player || mintedCard.player_name,
          season: mintedCard.season,
          position: mintedCard.position,
          tier: mintedCard.tier,
          composite_score: mintedCard.composite_score,
        });
        if (engine) {
          mintedCard.engine_v = engine.engine_v;
          mintedCard.engine_era = engine.engine_era;
          mintedCard.engine_percentiles = engine.engine_percentiles;
          mintedCard.engine_traits = engine.engine_traits;
          mintedCard.engine_inferred = engine.engine_inferred;
        }

        // Get formatted stats for card back
        mintedCard.stats = cardImageGenerator.getFormattedStats(mintedCard);
        
        // Use placeholder image initially if AI is enabled
        let imageUrl;
        let imagePending = false;
        
        if (AI_ENABLED) {
          imageUrl = '/cards/placeholder.svg';
          imagePending = true;
        } else {
          imageUrl = await cardImageGenerator.getOrGenerateCardImage(mintedCard);
        }
        
        mintedCard.image_url = imageUrl;
        mintedCard.image_pending = imagePending;
        
        const cardId = await db.addCard(req.user.id, mintedCard);
        const savedCard = { 
          id: cardId, 
          ...mintedCard,
          image_url: imageUrl,
          image_pending: imagePending,
          packNumber: currentPackNum + 1,
          packType: isStarterPack ? 'starter' : 'bonus'
        };
        allCards.push(savedCard);
        mintedThisPack += 1;
        
        if (imagePending) {
          cardsToGenerateImages.push({ cardId, card: savedCard });
        }
      }
      
      if (mintedThisPack === desiredCount) {
        await db.incrementPacksOpened(req.user.id);
      } else {
        return res.status(500).json({ error: 'Failed to mint a full pack during open-all. Please try again.' });
      }
    }
    
    // Generate AI images in background (don't wait)
    if (cardsToGenerateImages.length > 0) {
      setImmediate(async () => {
        for (const { cardId, card } of cardsToGenerateImages) {
          try {
            console.log(`Background: Generating AI image for card ${cardId}...`);
            const imageUrl = await cardImageGenerator.getOrGenerateCardImage(card);
            await db.updateCardImage(cardId, imageUrl);
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
    return true;
  }
  
  // Has placeholder image
  if (card.image_url.includes('placeholder')) {
    return true;
  }
  
  // SVG = fallback, needs AI regeneration to get PNG
  if (card.image_url.endsWith('.svg')) {
    return true;
  }
  
  // Marked as pending
  if (card.image_pending) {
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
  
  return true;
}

// Helper: Enqueue image regeneration (rate-limited)
function enqueueCardImageRegen(card) {
  if (!AI_ENABLED) return false;
  return imageRegenQueue.enqueue(card.id, card, 'api_request');
}

// Get all user's cards
app.get('/api/cards', authMiddleware, async (req, res) => {
  const cards = await db.getUserCards(req.user.id);
  
  // Check for cards needing image regeneration
  if (AI_ENABLED) {
    for (const card of cards) {
      if (cardNeedsImage(card)) {
        enqueueCardImageRegen(card);
      }
    }
  }
  
  res.json({ cards });
});

// Get cards by position
app.get('/api/cards/position/:position', authMiddleware, async (req, res) => {
  const cards = await db.getUserCardsByPosition(req.user.id, req.params.position.toUpperCase());
  res.json({ cards });
});

// Get single card
app.get('/api/cards/:id', authMiddleware, async (req, res) => {
  const card = await db.getCard(parseInt(req.params.id));
  
  if (!card || card.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Card not found' });
  }
  
  res.json({ card });
});

// =============================================================================
// VIEW OTHER USERS' COLLECTIONS
// =============================================================================

// Get all users with their card counts (for browsing)
app.get('/api/users', authMiddleware, async (req, res) => {
  const users = await db.getAllUsers();
  const userList = await Promise.all(users.map(async (u) => {
    const cards = await db.getUserCards(u.id);
    const stats = await db.getUserStats(u.id);
    return { id: u.id, username: u.username, team_name: u.team_name, card_count: cards.length, stats };
  }));
  res.json({ users: userList });
});

// Get another user's card collection
app.get('/api/users/:userId/cards', authMiddleware, async (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = await db.getUser(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const cards = await db.getUserCards(userId);
  
  // Check for cards needing image regeneration
  if (AI_ENABLED) {
    for (const card of cards) {
      if (cardNeedsImage(card)) {
        enqueueCardImageRegen(card);
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
app.get('/api/users/:userId/roster', authMiddleware, async (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = await db.getUser(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const fullRoster = await db.getFullRoster(userId);
  
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
app.get('/api/roster', authMiddleware, async (req, res) => {
  const fullRoster = await db.getFullRoster(req.user.id);
  res.json(fullRoster);
});

// Tier cap for roster building (sum of all 11 starter tiers)
const TIER_CAP = 75;

// Helper to calculate tier sum from roster cards
function calculateRosterTierSum(cards) {
  if (!cards) return 0;
  const slotIds = [
    'qb_card_id', 'rb_card_id', 'wr1_card_id', 'wr2_card_id', 'te_card_id',
    'ol_card_id', 'dl_card_id', 'lb_card_id', 'db1_card_id', 'db2_card_id', 'k_card_id'
  ];
  let sum = 0;
  for (const slotId of slotIds) {
    const card = cards[slotId];
    if (card?.tier) sum += card.tier;
  }
  return sum;
}

// Update roster slot
app.put('/api/roster', authMiddleware, async (req, res) => {
  try {
    const { slots } = req.body;
    
    if (!slots || typeof slots !== 'object') {
      return res.status(400).json({ error: 'Invalid slots data' });
    }
    
    // Get current roster to check tier cap
    const currentRoster = await db.getFullRoster(req.user.id);
    const currentCards = currentRoster?.cards || {};
    
    // Build a preview of the new roster to check tier cap
    const newCards = { ...currentCards };
    for (const [slot, cardId] of Object.entries(slots)) {
      if (cardId !== null) {
        const card = await db.getCard(cardId);
        if (!card || card.user_id !== req.user.id) {
          return res.status(400).json({ error: `Card ${cardId} not found or not owned` });
        }
        newCards[slot] = card;
      } else {
        newCards[slot] = null;
      }
    }
    
    // Check tier cap
    const newTierSum = calculateRosterTierSum(newCards);
    if (newTierSum > TIER_CAP) {
      return res.status(400).json({ 
        error: `Roster exceeds tier cap of ${TIER_CAP}. Current: ${newTierSum}`,
        tierSum: newTierSum,
        tierCap: TIER_CAP
      });
    }
    
    await db.updateRoster(req.user.id, slots);
    const fullRoster = await db.getFullRoster(req.user.id);
    res.json(fullRoster);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-fill roster with best available cards (optional strategy: balanced | pass_heavy | run_heavy)
// Respects tier cap by picking best cards that fit under the cap
app.post('/api/roster/auto-fill', authMiddleware, async (req, res) => {
  try {
    const cards = await db.getUserCards(req.user.id);
    const strategy = ['balanced', 'pass_heavy', 'run_heavy'].includes(req.body?.strategy)
      ? req.body.strategy
      : 'balanced';
    const defenseStrategy = ['coverage_shell', 'run_stuff', 'base_defense'].includes(req.body?.defenseStrategy)
      ? req.body.defenseStrategy
      : 'base_defense';
    const slots = gameEngine.autoFillRoster(cards, strategy, defenseStrategy, TIER_CAP);
    await db.updateRoster(req.user.id, slots);
    const fullRoster = await db.getFullRoster(req.user.id);
    res.json(fullRoster);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// GAME ROUTES
// =============================================================================

// Practice simulation (doesn't affect standings)
app.post('/api/games/practice', authMiddleware, async (req, res) => {
  try {
    const { opponent_id } = req.body;
    
    if (!opponent_id) {
      return res.status(400).json({ error: 'Opponent ID required' });
    }
    
    const opponent = await db.getUser(opponent_id);
    if (!opponent) {
      return res.status(404).json({ error: 'Opponent not found' });
    }
    
    // Get both rosters (full roster format that game engine expects)
    const myRoster = await db.getFullRoster(req.user.id);
    const opponentRoster = await db.getFullRoster(opponent_id);
    
    if (!myRoster.cards || Object.keys(myRoster.cards).length === 0) {
      return res.status(400).json({ error: 'You need to set your roster first' });
    }
    
    if (!opponentRoster.cards || Object.keys(opponentRoster.cards).length === 0) {
      return res.status(400).json({ error: 'Opponent has no roster set' });
    }
    
    // Run simulation using game engine (home = you, away = opponent)
    const result = gameEngine.simulateGameFromDB(myRoster, opponentRoster);
    
    // Extract significant plays for post-game report
    const significantPlays = [];
    if (result.plays) {
      for (const play of result.plays) {
        // Skip extra points and kickoffs for key plays display
        if (play.type === 'extra_point' || play.type === 'kickoff') continue;
        
        // Touchdowns (marked by game-bridge)
        if (play.touchdown) {
          significantPlays.push({
            type: 'touchdown',
            quarter: play.quarter,
            time: play.time,
            team: play.possession === 'home' ? 'you' : 'opponent',
            description: play.description,
          });
          continue;
        }
        // Field Goals
        if (play.type === 'field_goal' && play.result === 'good') {
          significantPlays.push({
            type: 'field_goal',
            quarter: play.quarter,
            time: play.time,
            team: play.possession === 'home' ? 'you' : 'opponent',
            description: play.description,
          });
          continue;
        }
        // Interceptions
        if (play.result === 'interception' || play.turnoverType === 'interception') {
          significantPlays.push({
            type: 'interception',
            quarter: play.quarter,
            time: play.time,
            team: play.possession === 'home' ? 'opponent' : 'you', // Defense gets it
            description: play.description,
          });
          continue;
        }
        // Fumbles
        if (play.result === 'fumble' || play.turnoverType === 'fumble') {
          significantPlays.push({
            type: 'fumble',
            quarter: play.quarter,
            time: play.time,
            team: play.possession === 'home' ? 'opponent' : 'you', // Defense recovers
            description: play.description,
          });
          continue;
        }
        // Sacks
        if (play.result === 'sack') {
          significantPlays.push({
            type: 'sack',
            quarter: play.quarter,
            time: play.time,
            team: play.possession === 'home' ? 'opponent' : 'you', // Defense gets sack
            description: play.description,
          });
          continue;
        }
        // Big plays (20+ yards)
        if (play.yards && play.yards >= 20) {
          significantPlays.push({
            type: 'big_play',
            quarter: play.quarter,
            time: play.time,
            team: play.possession === 'home' ? 'you' : 'opponent',
            description: play.description,
            yards: play.yards,
          });
        }
      }
    }
    
    // Return detailed result for post-game report
    res.json({
      yourScore: result.homeScore,
      opponentScore: result.awayScore,
      winner: result.homeScore > result.awayScore ? 'you' : 
              result.awayScore > result.homeScore ? 'opponent' : 'tie',
      isPractice: true,
      yourTeam: req.user.team_name || req.user.username,
      opponentTeam: opponent.team_name || opponent.username,
      stats: {
        you: result.homeStats || result.stats?.home || {},
        opponent: result.awayStats || result.stats?.away || {},
      },
      significantPlays: significantPlays.slice(0, 15), // Limit to top 15 plays
      summary: result.summary,
    });
  } catch (err) {
    console.error('Practice simulation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get list of opponents
app.get('/api/opponents', authMiddleware, async (req, res) => {
  const all = await db.getAllUsers();
  const users = all.filter(u => u.id !== req.user.id);
  const opponents = await Promise.all(users.map(async (u) => {
    const stats = await db.getUserStats(u.id);
    return { ...u, stats };
  }));
  res.json({ opponents });
});

// Challenge an opponent
app.post('/api/game/challenge', authMiddleware, async (req, res) => {
  try {
    const { opponentId } = req.body;
    
    if (!opponentId) {
      return res.status(400).json({ error: 'Opponent ID required' });
    }
    
    const opponent = await db.getUser(opponentId);
    if (!opponent) {
      return res.status(404).json({ error: 'Opponent not found' });
    }
    
    // Get both rosters
    const homeRoster = await db.getFullRoster(req.user.id);
    const awayRoster = await db.getFullRoster(opponentId);
    
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
    const gameId = await db.recordGame(
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
app.post('/api/game/quick-match', authMiddleware, async (req, res) => {
  try {
    // Find random opponent with a roster
    const users = await db.getAllUsers().filter(u => u.id !== req.user.id);
    
    if (users.length === 0) {
      return res.status(400).json({ error: 'No opponents available' });
    }
    
    const withRosters = await Promise.all(users.map(async (u) => ({ u, roster: await db.getFullRoster(u.id) })));
    const validOpponents = withRosters.filter(({ roster }) => roster && Object.keys(roster.cards || {}).length > 0).map(({ u }) => u);
    
    if (validOpponents.length === 0) {
      return res.status(400).json({ error: 'No opponents with rosters available' });
    }
    
    const opponent = validOpponents[Math.floor(Math.random() * validOpponents.length)];
    
    // Forward to challenge endpoint
    req.body.opponentId = opponent.id;
    
    // Get both rosters
    const homeRoster = await db.getFullRoster(req.user.id);
    const awayRoster = await db.getFullRoster(opponent.id);
    
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
    const gameId = await db.recordGame(
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
app.get('/api/game/:id', authMiddleware, async (req, res) => {
  const game = await db.getGame(parseInt(req.params.id));
  
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json({ game });
});

// Get user's game history
app.get('/api/games', authMiddleware, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const games = await db.getUserGames(req.user.id, limit);
  res.json({ games });
});

// =============================================================================
// PRESS CONFERENCE (Post-Game Chat)
// =============================================================================

// Get all active press conferences for the current user
app.get('/api/press-conference', authMiddleware, async (req, res) => {
  const conferences = pressConference.getActiveConferencesForUser(req.user.id);
  res.json({ conferences });
});

// Get messages for a specific game's press conference
app.get('/api/press-conference/:gameId', authMiddleware, async (req, res) => {
  const gameId = parseInt(req.params.gameId);
  const since = req.query.since || null;
  
  const result = pressConference.getMessages(gameId, req.user.id, since);
  
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  
  res.json(result);
});

// Send a message in a press conference
app.post('/api/press-conference/:gameId/message', authMiddleware, async (req, res) => {
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

app.get('/api/leaderboard', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const leaderboard = await db.getLeaderboard(limit);
  res.json({ leaderboard });
});

// =============================================================================
// SEARCH (for testing)
// =============================================================================

app.get('/api/players/search', authMiddleware, async (req, res) => {
  const query = req.query.q || '';
  const results = packs.searchPlayers(query, 20);
  res.json({ players: results });
});

// =============================================================================
// SCHEDULE ROUTES
// =============================================================================

// Get today's schedule
app.get('/api/schedule/today', authMiddleware, async (req, res) => {
  const games = scheduler.getTodaySchedule();
  const users = await db.getAllUsers();
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
app.get('/api/schedule/tomorrow', authMiddleware, async (req, res) => {
  const games = scheduler.getTomorrowSchedule();
  const users = await db.getAllUsers();
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
app.get('/api/schedule', authMiddleware, async (req, res) => {
  const schedule = await scheduler.getScheduleWithDetails();
  res.json(schedule);
});

// Get my upcoming games
app.get('/api/schedule/my-games', authMiddleware, async (req, res) => {
  const schedule = scheduler.loadSchedule();
  const users = await db.getAllUsers();
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

// Standings (team records from regular-season completed games; used for playoff seeding)
app.get('/api/schedule/standings', authMiddleware, async (req, res) => {
  const schedule = scheduler.loadSchedule();
  const standings = await scheduler.getStandings(schedule);
  res.json({ standings });
});

// Admin: Initialize/reset schedule (for testing)
app.post('/api/schedule/init', authMiddleware, async (req, res) => {
  const { reset } = req.body;
  const schedule = await scheduler.initializeSchedule(reset === true);
  res.json({ 
    message: reset ? 'Schedule reset' : 'Schedule initialized',
    seasonStart: schedule.seasonStart,
    totalGames: schedule.games.length,
  });
});

// Admin: Run pending games now (for testing)
app.post('/api/schedule/run-now', authMiddleware, async (req, res) => {
  const results = scheduler.runPendingGames();
  res.json({ 
    message: `Ran ${results.length} games`,
    results,
  });
});

// Admin: Swap user in schedule (e.g. John! for Nick! in all games, including today/tomorrow)
app.post('/api/schedule/swap-user', authMiddleware, async (req, res) => {
  try {
    const { fromUsername, toUsername } = req.body;
    if (!fromUsername || !toUsername) {
      return res.status(400).json({ error: 'fromUsername and toUsername required' });
    }
    const result = await scheduler.swapUserInSchedule(fromUsername, toUsername);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =============================================================================
// MINTING STATS
// =============================================================================

app.get('/api/minting/stats', authMiddleware, async (req, res) => {
  const stats = mintingLedger.getAvailabilityStats();
  res.json(stats);
});

// =============================================================================
// DIRECT MESSAGES
// =============================================================================

// Get unread message count
app.get('/api/messages/unread-count', authMiddleware, async (req, res) => {
  const count = messages.getUnreadCount(req.user.id);
  res.json({ count });
});

// Get inbox (received messages)
app.get('/api/messages/inbox', authMiddleware, async (req, res) => {
  const inbox = messages.getInbox(req.user.id);
  const enriched = await Promise.all(inbox.map(async (msg) => {
    const sender = await db.getUser(msg.from_user_id);
    return { ...msg, from_username: sender?.username || 'Unknown', from_team_name: sender?.team_name || 'Unknown Team' };
  }));
  res.json({ messages: enriched });
});

// Get conversation with a user
app.get('/api/messages/conversation/:userId', authMiddleware, async (req, res) => {
  const otherUserId = parseInt(req.params.userId);
  const conversation = messages.getConversation(req.user.id, otherUserId);
  
  // Mark messages from other user as read
  messages.markAsRead(req.user.id, otherUserId);
  
  // Enrich with user info
  const otherUser = await db.getUser(otherUserId);
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
app.post('/api/messages/send', authMiddleware, async (req, res) => {
  try {
    const { to_user_id, content } = req.body;
    
    if (!to_user_id || !content) {
      return res.status(400).json({ error: 'Missing to_user_id or content' });
    }
    
    // Verify recipient exists
    const recipient = await db.getUser(parseInt(to_user_id));
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
app.post('/api/admin/add-packs', async (req, res) => {
  try {
    const { username, packs_to_add } = req.body;
    
    if (!username || !packs_to_add) {
      return res.status(400).json({ error: 'Missing username or packs_to_add' });
    }
    
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: `User "${username}" not found` });
    }
    
    const newMax = user.max_packs + parseInt(packs_to_add);
    await db.updateUserMaxPacks(user.id, newMax);
    
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

// Admin: Grant a single-card pack (no login required)
app.post('/api/admin/grant-single-card-pack', adminAuth, async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Missing username' });
    }
    
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: `User "${username}" not found` });
    }
    
    // Grant a single pack without opening it
    await db.updateUserMaxPacks(user.id, (user.max_packs || 0) + 1);
    
    res.json({ 
      success: true,
      username,
      max_packs: (user.max_packs || 0) + 1,
      packs_remaining: (user.max_packs || 0) + 1 - user.packs_opened,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shared: grant one HOF (tier 11) card to a user. position optional (e.g. 'WR').
// When position is set, only that position is granted (no fallback). Generates art synchronously when AI enabled.
async function grantHofCardToUser(user, position) {
  let hofPlayer = null;
  if (position) {
    hofPlayer = await packs.pickRandomPlayerFromTierAndPosition(11, position);
    if (!hofPlayer) throw new Error(`No unminted HOF ${position} available`);
    const cardPos = hofPlayer.position || hofPlayer.pos_group || hofPlayer.pos;
    if (cardPos !== position) throw new Error(`Position mismatch: requested ${position}, got ${cardPos}`);
  } else {
    for (let attempt = 0; attempt < 50; attempt++) {
      const p = await packs.pickRandomPlayerFromTier(11);
      if (p && (p.tier === 11 || p.isHOF) && (await mintingLedger.isCardMinted(p)) === false) {
        hofPlayer = p;
        break;
      }
    }
    if (!hofPlayer) throw new Error('No unminted Hall of Fame player available');
  }
  await mintingLedger.mintCard(hofPlayer, user.id);
  const mintedCard = { ...hofPlayer, player_name: hofPlayer.player || hofPlayer.player_name };
  const engine = buildEngineForCard({
    player_name: mintedCard.player_name,
    season: mintedCard.season,
    position: mintedCard.position,
    tier: mintedCard.tier,
    composite_score: mintedCard.composite_score,
  });
  if (engine) {
    mintedCard.engine_v = engine.engine_v;
    mintedCard.engine_era = engine.engine_era;
    mintedCard.engine_percentiles = engine.engine_percentiles;
    mintedCard.engine_traits = engine.engine_traits;
    mintedCard.engine_inferred = engine.engine_inferred;
  }
  mintedCard.stats = cardImageGenerator.getFormattedStats(mintedCard);
  let imageUrl = '/cards/placeholder.svg';
  let imagePending = false;
  try {
    imageUrl = await cardImageGenerator.getOrGenerateCardImage(mintedCard);
  } catch (_) {
    if (AI_ENABLED) imagePending = true;
  }
  mintedCard.image_url = imageUrl;
  mintedCard.image_pending = imagePending;
  const cardId = await db.addCard(user.id, mintedCard);
  if (imagePending && AI_ENABLED) {
    enqueueCardImageRegen({ id: cardId, ...mintedCard });
  }
  return { cardId, card: mintedCard };
}

// Admin: Grant one Hall of Fame (tier 11) card to a user (optional: position e.g. 'WR')
app.post('/api/admin/grant-hof-card', adminAuth, async (req, res) => {
  try {
    const { username, position } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const user = await db.getUserByUsernameCaseInsensitive(username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { cardId, card: mintedCard } = await grantHofCardToUser(user, position || null);
    res.json({
      success: true,
      username: user.username,
      card: { id: cardId, player_name: mintedCard.player_name, season: mintedCard.season, tier: 11, position: mintedCard.position },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint to see card image status (no auth for easy debugging)
app.get('/api/admin/debug-images', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  const PERSISTENT_DIR = '/var/data';
  const USE_PERSISTENT = fs.existsSync(PERSISTENT_DIR);
  
  const allUsers = await db.getAllUsers();
  const results = [];
  
  for (const user of allUsers) {
    const cards = await db.getUserCards(user.id);
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

app.post('/api/admin/regenerate-images', adminAuth, async (req, res) => {
  if (!AI_ENABLED) {
    return res.status(400).json({ error: 'AI image generation not enabled (no OPENAI_API_KEY)' });
  }
  
  // Get all cards from all users
  const allUsers = await db.getAllUsers();
  let cardsToRegenerate = [];
  
  for (const user of allUsers) {
    const cards = await db.getUserCards(user.id);
    for (const card of cards) {
      if (cardNeedsImage(card)) {
        cardsToRegenerate.push(card);
      }
    }
  }
  
  // Trigger regeneration for all missing images
  for (const card of cardsToRegenerate) {
    enqueueCardImageRegen(card);
  }
  
  res.json({ 
    message: `Regenerating images for ${cardsToRegenerate.length} cards`,
    cards: cardsToRegenerate.map(c => ({ id: c.id, player: c.player || c.player_name })),
    queue: imageRegenQueue.getStats(),
  });
});

// =============================================================================
// NFT METADATA (public)
// =============================================================================

app.get('/api/nft/metadata/:tokenId.json', async (req, res) => {
  try {
    if (!dbPool.useDatabase()) return res.status(404).json({ error: 'Not configured' });
    const tokenId = parseInt(req.params.tokenId);
    const r = await dbPool.query(
      'SELECT bpc.* FROM blockchain_pack_cards bpc WHERE bpc.token_id = $1 LIMIT 1',
      [tokenId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Token not found' });
    const c = r.rows[0];
    const tierNames = { 11: 'Hall of Fame', 10: 'Legendary', 9: 'Epic', 8: 'Ultra Rare', 7: 'Very Rare', 6: 'Rare', 5: 'Uncommon+', 4: 'Uncommon', 3: 'Common+', 2: 'Common', 1: 'Basic' };
    const apiUrl = process.env.API_URL || 'http://localhost:4000';
    res.json({
      name: `${c.player_name} (${c.season})`,
      description: `${c.player_name} - ${c.season} Season | ${c.position || 'Player'} | ${tierNames[c.tier] || 'Unknown'} Tier`,
      image: `${apiUrl}/api/nft/image/${tokenId}.svg`,
      attributes: [
        { trait_type: 'Player', value: c.player_name },
        { trait_type: 'Season', value: c.season },
        { trait_type: 'Position', value: c.position || 'Unknown' },
        { trait_type: 'Tier', value: tierNames[c.tier] || 'Unknown' },
      ],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get metadata' });
  }
});

app.get('/api/nft/image/:tokenId.svg', async (req, res) => {
  try {
    if (!dbPool.useDatabase()) return res.status(404).send('Not configured');
    const tokenId = parseInt(req.params.tokenId);
    const r = await dbPool.query('SELECT * FROM blockchain_pack_cards WHERE token_id = $1 LIMIT 1', [tokenId]);
    if (r.rows.length === 0) return res.status(404).send('Token not found');
    const c = r.rows[0];
    const { buildTieredCardSVG } = require('./nft-generator/tier-templates');
    const svg = buildTieredCardSVG({ name: c.player_name, season: c.season, team: c.team || '—', position: c.position || 'Unknown', tier: c.tier || 5, stats: {} });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    res.status(500).send('Failed to generate image');
  }
});

// =============================================================================
// BLOCKCHAIN PACKS & WALLET
// =============================================================================

app.get('/api/blockchain/pack/:packId', async (req, res) => {
  try {
    const pack = await packFulfillment.getPackStatus(req.params.packId);
    if (!pack) return res.status(404).json({ error: 'Pack not found' });
    res.json(pack);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/blockchain/packs/:walletAddress', async (req, res) => {
  try {
    const packsList = await packFulfillment.getPacksForWallet(req.params.walletAddress);
    res.json(packsList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/my-packs', authMiddleware, async (req, res) => {
  try {
    const wallet = await db.getUserWallet(req.user.id);
    if (!wallet) return res.json({ packs: [] });
    const packsList = await packFulfillment.getPacksForWallet(wallet.address);
    res.json({ packs: packsList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wallet', authMiddleware, async (req, res) => {
  try {
    const wallet = await db.getUserWallet(req.user.id);
    if (!wallet) return res.json({ wallet: null });
    res.json({ wallet: { address: wallet.address, walletType: wallet.wallet_type, chainId: wallet.chain_id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wallet/sign-message', authMiddleware, async (req, res) => {
  const msg = `Sign in to First & 10. Nonce: ${Date.now()}`;
  res.json({ message: msg });
});

app.post('/api/wallet/link', authMiddleware, async (req, res) => {
  try {
    const { address, walletType, signature } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    await db.linkWallet(req.user.id, address, walletType || 'external', 84532);
    const wallet = await db.getUserWallet(req.user.id);
    res.json({ wallet: { address: wallet.address, walletType: wallet.wallet_type } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/wallet/check/:address', authMiddleware, async (req, res) => {
  try {
    const wallet = await db.getWalletByAddress(req.params.address);
    if (wallet && wallet.user_id !== req.user.id) return res.json({ linked: true, linkedToOther: true });
    res.json({ linked: !!wallet, linkedToOther: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/fulfill-pack/:packId', async (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  try {
    await packFulfillment.pollForEvents();
    const pack = await packFulfillment.getPackStatus(req.params.packId);
    res.json({ success: true, pack });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/poll-events', async (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  try {
    await packFulfillment.pollForEvents();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// HEALTH CHECK (for Render)
// =============================================================================

app.get('/health', async (req, res) => {
  const dbOk = dbPool.useDatabase() ? await dbPool.testConnection() : true;
  res.json({ status: dbOk ? 'ok' : 'degraded', database: dbOk ? 'connected' : 'disconnected', timestamp: new Date().toISOString() });
});

app.get('/', async (req, res) => {
  res.json({ name: 'First & 10 API', version: '2.0.0', database: dbPool.useDatabase() ? 'postgres' : 'json', status: 'running' });
});

// Global error handler: ensure every error returns JSON (no plain "Internal Server Error")
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const msg = (err && (err.message || String(err))) || 'Internal server error';
  console.error('Unhandled error:', err);
  res.status(500).json({ error: msg });
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(PORT, '0.0.0.0', async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const dbConnected = dbPool.useDatabase() ? await dbPool.testConnection() : true;
  if (dbPool.useDatabase() && !dbConnected) console.warn('WARNING: Postgres connection failed. Check DATABASE_URL.');
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║             First & 10 - API Server                        ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                              ║
║  Database: ${(dbPool.useDatabase() ? (dbConnected ? 'Postgres (connected)' : 'Postgres (FAILED)') : 'JSON file').padEnd(24)}     ║
║                                                           ║
║  POST /api/auth/login       - Login                       ║
║  GET  /api/cards            - View your cards             ║
║  GET  /api/my-packs         - Your NFT packs              ║
║  GET  /api/leaderboard      - View standings              ║
╚═══════════════════════════════════════════════════════════╝
  `);
  packs.loadPlayers();
  scheduler.startScheduler();
  if (process.env.PRIVATE_KEY && dbPool.useDatabase()) packFulfillment.start(15000).catch(() => {});
  // Ensure John! has a tier-11 WR (no-op if he already has one). Runs for both Postgres and JSON (live).
  ensureJohnHasHofWR().catch((err) => console.warn('ensureJohnHasHofWR:', err.message));
});

async function ensureJohnHasHofWR() {
  const user = await db.getUserByUsernameCaseInsensitive('John!');
  if (!user) return;
  const cards = await db.getUserCards(user.id);
  const hasHofWR = cards.some((c) => (c.tier === 11 || c.isHOF) && (c.position === 'WR'));
  if (hasHofWR) return;
  await grantHofCardToUser(user, 'WR');
  console.log('Granted John! a tier-11 WR (startup ensure).');
}
