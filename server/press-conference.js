/**
 * Post-Game Press Conference
 * ===========================
 * Allows two users who played each other to chat for 30 minutes after a game
 */

const fs = require('fs');
const path = require('path');

// Use persistent disk in production, local file in development
const DATA_DIR = fs.existsSync('/var/data') ? '/var/data' : __dirname;
const CHAT_FILE = path.join(DATA_DIR, 'press-conferences.json');
const CHAT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Load chat data
function loadChats() {
  try {
    if (fs.existsSync(CHAT_FILE)) {
      return JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading press conferences:', e);
  }
  return { conferences: {} };
}

// Save chat data
function saveChats(data) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(data, null, 2));
}

/**
 * Create a press conference for a game
 * Called automatically when a game ends
 */
function createConference(gameId, player1Id, player2Id, player1Name, player2Name) {
  const data = loadChats();
  
  const conferenceId = `conf_${gameId}`;
  
  data.conferences[conferenceId] = {
    id: conferenceId,
    gameId,
    players: {
      [player1Id]: player1Name,
      [player2Id]: player2Name,
    },
    playerIds: [player1Id, player2Id],
    messages: [],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + CHAT_DURATION_MS).toISOString(),
    active: true,
  };
  
  saveChats(data);
  
  return data.conferences[conferenceId];
}

/**
 * Check if a conference is still active (within 30 min window)
 */
function isConferenceActive(conference) {
  if (!conference || !conference.active) return false;
  return new Date() < new Date(conference.expiresAt);
}

/**
 * Get a conference by game ID
 */
function getConferenceByGameId(gameId) {
  const data = loadChats();
  const conferenceId = `conf_${gameId}`;
  const conference = data.conferences[conferenceId];
  
  if (!conference) return null;
  
  // Check if expired
  if (!isConferenceActive(conference)) {
    conference.active = false;
    saveChats(data);
  }
  
  return conference;
}

/**
 * Get all active conferences for a user
 */
function getActiveConferencesForUser(userId) {
  const data = loadChats();
  const activeConferences = [];
  
  for (const conference of Object.values(data.conferences)) {
    if (conference.playerIds.includes(userId) && isConferenceActive(conference)) {
      activeConferences.push({
        ...conference,
        timeRemaining: Math.max(0, new Date(conference.expiresAt) - new Date()),
        unreadCount: getUnreadCount(conference, userId),
      });
    }
  }
  
  // Sort by most recent first
  activeConferences.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return activeConferences;
}

/**
 * Get unread message count for a user in a conference
 */
function getUnreadCount(conference, userId) {
  return conference.messages.filter(m => 
    m.senderId !== userId && !m.readBy?.includes(userId)
  ).length;
}

/**
 * Send a message in a conference
 */
function sendMessage(gameId, userId, userName, content) {
  const data = loadChats();
  const conferenceId = `conf_${gameId}`;
  const conference = data.conferences[conferenceId];
  
  if (!conference) {
    return { error: 'Conference not found' };
  }
  
  if (!conference.playerIds.includes(userId)) {
    return { error: 'You are not a participant in this game' };
  }
  
  if (!isConferenceActive(conference)) {
    return { error: 'Press conference has ended (30 min limit)' };
  }
  
  // Sanitize content
  const sanitizedContent = content
    .trim()
    .slice(0, 500) // Max 500 characters
    .replace(/<[^>]*>/g, ''); // Remove HTML tags
  
  if (!sanitizedContent) {
    return { error: 'Message cannot be empty' };
  }
  
  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    senderId: userId,
    senderName: userName,
    content: sanitizedContent,
    timestamp: new Date().toISOString(),
    readBy: [userId],
  };
  
  conference.messages.push(message);
  saveChats(data);
  
  return { success: true, message };
}

/**
 * Get messages for a conference
 */
function getMessages(gameId, userId, since = null) {
  const data = loadChats();
  const conferenceId = `conf_${gameId}`;
  const conference = data.conferences[conferenceId];
  
  if (!conference) {
    return { error: 'Conference not found' };
  }
  
  if (!conference.playerIds.includes(userId)) {
    return { error: 'You are not a participant in this game' };
  }
  
  // Mark messages as read
  let hasChanges = false;
  for (const message of conference.messages) {
    if (!message.readBy) message.readBy = [];
    if (!message.readBy.includes(userId)) {
      message.readBy.push(userId);
      hasChanges = true;
    }
  }
  if (hasChanges) {
    saveChats(data);
  }
  
  // Filter by since timestamp if provided
  let messages = conference.messages;
  if (since) {
    const sinceDate = new Date(since);
    messages = messages.filter(m => new Date(m.timestamp) > sinceDate);
  }
  
  // Get opponent info
  const opponentId = conference.playerIds.find(id => id !== userId);
  const opponentName = conference.players[opponentId];
  
  return {
    conferenceId,
    gameId: conference.gameId,
    active: isConferenceActive(conference),
    expiresAt: conference.expiresAt,
    timeRemaining: Math.max(0, new Date(conference.expiresAt) - new Date()),
    opponent: {
      id: opponentId,
      name: opponentName,
    },
    messages,
  };
}

/**
 * Clean up expired conferences (keep for 24 hours after expiry for history)
 */
function cleanupExpired() {
  const data = loadChats();
  const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
  
  for (const [id, conference] of Object.entries(data.conferences)) {
    const expiresAt = new Date(conference.expiresAt).getTime();
    if (expiresAt < cutoff) {
      delete data.conferences[id];
    }
  }
  
  saveChats(data);
}

// Run cleanup periodically
setInterval(cleanupExpired, 60 * 60 * 1000); // Every hour

module.exports = {
  createConference,
  getConferenceByGameId,
  getActiveConferencesForUser,
  sendMessage,
  getMessages,
  isConferenceActive,
  CHAT_DURATION_MS,
};
