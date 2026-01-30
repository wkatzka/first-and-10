/**
 * Direct Messages System
 * ======================
 * Allows users to send messages to each other
 */

const fs = require('fs');
const path = require('path');

// Use persistent disk in production, local file in development
const PERSISTENT_DIR = '/var/data';
const USE_PERSISTENT = fs.existsSync(PERSISTENT_DIR);
const DATA_DIR = USE_PERSISTENT ? PERSISTENT_DIR : __dirname;
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Load messages data
function loadMessages() {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading messages:', e);
  }
  return { messages: [], nextId: 1 };
}

// Save messages data
function saveMessages(data) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data, null, 2));
}

/**
 * Send a message to another user
 */
function sendMessage(fromUserId, toUserId, content) {
  if (!content || content.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }
  
  if (content.length > 500) {
    throw new Error('Message too long (max 500 characters)');
  }
  
  if (fromUserId === toUserId) {
    throw new Error('Cannot message yourself');
  }
  
  const data = loadMessages();
  
  const message = {
    id: data.nextId++,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    content: content.trim(),
    sent_at: new Date().toISOString(),
    read: false,
  };
  
  data.messages.push(message);
  saveMessages(data);
  
  return message;
}

/**
 * Get messages for a user (inbox)
 */
function getInbox(userId) {
  const data = loadMessages();
  return data.messages
    .filter(m => m.to_user_id === userId)
    .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
}

/**
 * Get sent messages
 */
function getSentMessages(userId) {
  const data = loadMessages();
  return data.messages
    .filter(m => m.from_user_id === userId)
    .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
}

/**
 * Get conversation between two users
 */
function getConversation(userId1, userId2) {
  const data = loadMessages();
  return data.messages
    .filter(m => 
      (m.from_user_id === userId1 && m.to_user_id === userId2) ||
      (m.from_user_id === userId2 && m.to_user_id === userId1)
    )
    .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
}

/**
 * Mark messages as read
 */
function markAsRead(userId, fromUserId) {
  const data = loadMessages();
  let updated = false;
  
  data.messages.forEach(m => {
    if (m.to_user_id === userId && m.from_user_id === fromUserId && !m.read) {
      m.read = true;
      updated = true;
    }
  });
  
  if (updated) {
    saveMessages(data);
  }
  
  return updated;
}

/**
 * Get unread message count
 */
function getUnreadCount(userId) {
  const data = loadMessages();
  return data.messages.filter(m => m.to_user_id === userId && !m.read).length;
}

/**
 * Get unread messages grouped by sender
 */
function getUnreadBySender(userId) {
  const data = loadMessages();
  const unread = data.messages.filter(m => m.to_user_id === userId && !m.read);
  
  const bySender = {};
  unread.forEach(m => {
    if (!bySender[m.from_user_id]) {
      bySender[m.from_user_id] = [];
    }
    bySender[m.from_user_id].push(m);
  });
  
  return bySender;
}

module.exports = {
  sendMessage,
  getInbox,
  getSentMessages,
  getConversation,
  markAsRead,
  getUnreadCount,
  getUnreadBySender,
};
