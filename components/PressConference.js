import { useState, useEffect, useRef } from 'react';
import { getConferenceMessages, sendConferenceMessage } from '../lib/api';

/**
 * Post-Game Press Conference Chat
 * ================================
 * 30-minute chat window between two players after a game
 */
export default function PressConference({ gameId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [conference, setConference] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Load messages
  const loadMessages = async (since = null) => {
    try {
      const data = await getConferenceMessages(gameId, since);
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      setConference(data);
      setTimeRemaining(data.timeRemaining);
      
      if (since) {
        // Append new messages
        if (data.messages.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = data.messages.filter(m => !existingIds.has(m.id));
            return [...prev, ...newMsgs];
          });
        }
      } else {
        setMessages(data.messages);
      }
    } catch (err) {
      setError(err.message);
    }
  };
  
  // Initial load
  useEffect(() => {
    loadMessages();
  }, [gameId]);
  
  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!conference?.active) return;
    
    const interval = setInterval(() => {
      const lastMessage = messages[messages.length - 1];
      loadMessages(lastMessage?.timestamp || null);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [conference?.active, messages]);
  
  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) return;
    
    const interval = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timeRemaining]);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Format time remaining
  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Send message
  const handleSend = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || sending) return;
    
    setSending(true);
    try {
      const result = await sendConferenceMessage(gameId, newMessage.trim());
      
      if (result.error) {
        setError(result.error);
      } else {
        setMessages(prev => [...prev, result.message]);
        setNewMessage('');
        inputRef.current?.focus();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };
  
  const isExpired = timeRemaining <= 0;
  
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-lg h-[80vh] max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🎤</span>
              Post-Game Press Conference
            </h2>
            {conference?.opponent && (
              <p className="text-sm text-gray-400">
                with {conference.opponent.name}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Timer */}
            {!isExpired ? (
              <div className="text-sm">
                <span className="text-gray-400">Time left: </span>
                <span className={`font-mono font-bold ${
                  timeRemaining < 60000 ? 'text-red-400' : 
                  timeRemaining < 300000 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
            ) : (
              <span className="text-sm text-red-400 font-medium">Ended</span>
            )}
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="bg-red-900/50 text-red-300 text-sm p-3 rounded-lg text-center">
              {error}
            </div>
          )}
          
          {messages.length === 0 && !error && (
            <div className="text-center text-gray-500 py-8">
              <span className="text-3xl block mb-2">🤝</span>
              <p>Say GG or share your thoughts!</p>
              <p className="text-sm mt-1">Be respectful - keep it fun.</p>
            </div>
          )}
          
          {messages.map((msg) => {
            const isMe = msg.senderId !== conference?.opponent?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-700 text-white rounded-bl-sm'
                  }`}
                >
                  {!isMe && (
                    <div className="text-xs text-gray-400 mb-1">
                      {msg.senderName}
                    </div>
                  )}
                  <p className="break-words">{msg.content}</p>
                  <div className={`text-xs mt-1 ${isMe ? 'text-blue-200' : 'text-gray-500'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input */}
        {!isExpired ? (
          <form onSubmit={handleSend} className="p-4 border-t border-gray-700">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                maxLength={500}
                className="flex-1 px-4 py-2 bg-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="px-4 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? '...' : 'Send'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {500 - newMessage.length} characters remaining
            </p>
          </form>
        ) : (
          <div className="p-4 border-t border-gray-700 text-center text-gray-400">
            <p>This press conference has ended.</p>
            <p className="text-sm">Chat is available for 30 minutes after each game.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Small indicator showing active press conferences
 */
export function PressConferenceBadge({ count, onClick }) {
  if (!count) return null;
  
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 md:bottom-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-colors z-40 animate-pulse"
    >
      <span>🎤</span>
      <span className="font-medium">{count} Active Chat{count > 1 ? 's' : ''}</span>
    </button>
  );
}
