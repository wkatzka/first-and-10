import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import Card from '../components/Card';
import CardModal from '../components/CardModal';
import { 
  getAllUsers, 
  getUserCards, 
  getInbox, 
  getConversation, 
  sendMessage,
  getUnreadCount,
  getLeaderboard,
} from '../lib/api';

export default function League({ user, onLogout, unreadMessages, onMessageRead }) {
  const router = useRouter();
  const [teams, setTeams] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Messages state
  const [showMessages, setShowMessages] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  
  // Conversation state
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // View cards state
  const [viewingTeamCards, setViewingTeamCards] = useState(null);
  const [teamCards, setTeamCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    loadTeams();
  }, [user, router]);
  
  // Auto-open messages if there are unread ones
  useEffect(() => {
    if (unreadMessages > 0 && !showMessages) {
      // Don't auto-open, let user click
    }
  }, [unreadMessages]);
  
  const loadTeams = async () => {
    try {
      const [usersData, leaderboardData] = await Promise.all([
        getAllUsers(),
        getLeaderboard(50),
      ]);
      
      const users = usersData.users || [];
      const lb = leaderboardData.leaderboard || [];
      
      // Merge leaderboard ranks into teams
      const teamsWithRank = users.map(team => {
        const lbEntry = lb.find(e => e.id === team.id);
        const rank = lbEntry ? lb.indexOf(lbEntry) + 1 : 999;
        return {
          ...team,
          rank,
          wins: lbEntry?.wins || team.stats?.wins || 0,
          losses: lbEntry?.losses || team.stats?.losses || 0,
          ties: lbEntry?.ties || team.stats?.ties || 0,
          total_games: lbEntry?.total_games || 0,
        };
      });
      
      // Sort by rank (teams with games first, then by wins)
      teamsWithRank.sort((a, b) => {
        if (a.total_games === 0 && b.total_games === 0) return 0;
        if (a.total_games === 0) return 1;
        if (b.total_games === 0) return -1;
        return a.rank - b.rank;
      });
      
      setTeams(teamsWithRank);
      setLeaderboard(lb);
    } catch (err) {
      console.error('Failed to load teams:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const loadInbox = async () => {
    setLoadingInbox(true);
    try {
      const data = await getInbox();
      setInbox(data.messages || []);
    } catch (err) {
      console.error('Failed to load inbox:', err);
    } finally {
      setLoadingInbox(false);
    }
  };
  
  const toggleMessages = () => {
    if (!showMessages) {
      loadInbox();
    }
    setShowMessages(!showMessages);
  };
  
  const openConversation = async (team) => {
    setSelectedTeam(team);
    setLoadingConvo(true);
    setConversation([]);
    
    try {
      const data = await getConversation(team.id);
      setConversation(data.messages || []);
      // Notify parent that messages were read
      if (onMessageRead) onMessageRead();
    } catch (err) {
      console.error('Failed to load conversation:', err);
    } finally {
      setLoadingConvo(false);
    }
  };
  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTeam || sendingMessage) return;
    
    setSendingMessage(true);
    try {
      await sendMessage(selectedTeam.id, newMessage.trim());
      setNewMessage('');
      // Reload conversation
      const data = await getConversation(selectedTeam.id);
      setConversation(data.messages || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingMessage(false);
    }
  };
  
  const viewTeamCards = async (team) => {
    setViewingTeamCards(team);
    setLoadingCards(true);
    setTeamCards([]);
    
    try {
      const data = await getUserCards(team.id);
      setTeamCards(data.cards || []);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setLoadingCards(false);
    }
  };
  
  // Group inbox messages by sender
  const groupedInbox = inbox.reduce((acc, msg) => {
    const key = msg.from_user_id;
    if (!acc[key]) {
      acc[key] = {
        from_user_id: msg.from_user_id,
        from_username: msg.from_username,
        from_team_name: msg.from_team_name,
        messages: [],
        unread_count: 0,
        latest: msg,
      };
    }
    acc[key].messages.push(msg);
    if (!msg.read) acc[key].unread_count++;
    return acc;
  }, {});
  
  const inboxSenders = Object.values(groupedInbox).sort(
    (a, b) => new Date(b.latest.sent_at) - new Date(a.latest.sent_at)
  );
  
  if (!user) return null;
  
  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">League</h1>
          <p className="text-gray-400">View teams, cards, and send messages</p>
        </div>
        
        {/* Messages Toggle */}
        <div className="flex justify-center">
          <button
            onClick={toggleMessages}
            className={`px-6 py-3 rounded-xl font-semibold transition-all relative ${
              showMessages 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {showMessages ? 'Hide Messages' : 'View Messages'}
            {unreadMessages > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {unreadMessages}
              </span>
            )}
          </button>
        </div>
        
        {/* Messages Section */}
        {showMessages && (
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-xl font-bold text-white mb-4">Messages</h2>
            
            {loadingInbox ? (
              <p className="text-gray-400 text-center py-4">Loading messages...</p>
            ) : inboxSenders.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No messages yet. Send a message to another team!</p>
            ) : (
              <div className="space-y-2">
                {inboxSenders.map(sender => (
                  <div
                    key={sender.from_user_id}
                    onClick={() => openConversation({ id: sender.from_user_id, username: sender.from_username, team_name: sender.from_team_name })}
                    className="bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          {sender.from_team_name || sender.from_username}
                          {sender.unread_count > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                              {sender.unread_count} new
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 truncate max-w-xs">
                          {sender.latest.content}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(sender.latest.sent_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Teams List - Ranked */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading teams...</div>
        ) : teams.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No teams yet. Invite some friends!
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {teams.map((team, index) => {
              const isMe = team.id === user.id;
              const rank = team.total_games > 0 ? team.rank : '-';
              const rankBg = rank === 1 ? 'bg-yellow-500' : rank === 2 ? 'bg-gray-400' : rank === 3 ? 'bg-orange-500' : 'bg-gray-600';
              
              return (
                <div
                  key={team.id}
                  className={`bg-gray-800 rounded-xl p-4 ${isMe ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank Badge */}
                    <div className={`w-12 h-12 ${rankBg} rounded-full flex items-center justify-center flex-shrink-0`}>
                      <span className={`font-bold text-lg ${rank <= 3 && rank !== '-' ? 'text-black' : 'text-white'}`}>
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                      </span>
                    </div>
                    
                    {/* Team Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white truncate">
                          {team.team_name || 'Unnamed Team'}
                        </h3>
                        {isMe && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">YOU</span>}
                      </div>
                      <p className="text-sm text-gray-400">{team.username}</p>
                    </div>
                    
                    {/* Record */}
                    <div className="text-center flex-shrink-0">
                      <div className="text-lg font-bold">
                        <span className="text-green-400">{team.wins}</span>
                        <span className="text-gray-500">-</span>
                        <span className="text-red-400">{team.losses}</span>
                        {team.ties > 0 && (
                          <>
                            <span className="text-gray-500">-</span>
                            <span className="text-yellow-400">{team.ties}</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{team.card_count} cards</div>
                    </div>
                  </div>
                  
                  {/* Action Buttons - only for other teams */}
                  {!isMe && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700">
                      <button
                        onClick={() => viewTeamCards(team)}
                        disabled={team.card_count === 0}
                        className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        View Cards
                      </button>
                      <button
                        onClick={() => openConversation(team)}
                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors text-sm"
                      >
                        Message
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Conversation Modal */}
        {selectedTeam && (
          <div 
            className="fixed inset-0 bg-black/90 flex flex-col z-50"
            onClick={() => setSelectedTeam(null)}
          >
            <div 
              className="flex-1 flex flex-col max-w-lg w-full mx-auto bg-gray-800 sm:my-8 sm:rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-700 safe-area-pt">
                <div>
                  <h2 className="font-bold text-white text-lg">{selectedTeam.team_name || selectedTeam.username}</h2>
                  <p className="text-xs text-gray-400">{selectedTeam.username}</p>
                </div>
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="text-gray-400 hover:text-white text-3xl leading-none w-10 h-10 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingConvo ? (
                  <p className="text-gray-400 text-center">Loading...</p>
                ) : conversation.length === 0 ? (
                  <p className="text-gray-500 text-center text-sm">No messages yet. Start the conversation!</p>
                ) : (
                  conversation.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl px-4 py-2 ${
                          msg.is_mine 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-700 text-white'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className="text-xs opacity-60 mt-1">
                          {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700 safe-area-pb">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    maxLength={500}
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="sentences"
                    enterKeyHint="send"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-base placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sendingMessage}
                    className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {sendingMessage ? '...' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* View Cards Modal */}
        {viewingTeamCards && (
          <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={() => setViewingTeamCards(null)}
          >
            <div 
              className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {viewingTeamCards.team_name || viewingTeamCards.username}'s Cards
                  </h2>
                  <p className="text-sm text-gray-400">
                    {teamCards.length} cards
                  </p>
                </div>
                <button
                  onClick={() => setViewingTeamCards(null)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              
              {loadingCards ? (
                <div className="text-center text-gray-400 py-8">Loading cards...</div>
              ) : teamCards.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No cards in collection
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {teamCards
                    .sort((a, b) => b.tier - a.tier)
                    .map(card => (
                      <Card 
                        key={card.id} 
                        card={card} 
                        small 
                        onClick={() => setSelectedCard(card)}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Card Detail Modal */}
        {selectedCard && (
          <CardModal 
            card={selectedCard} 
            onClose={() => setSelectedCard(null)} 
          />
        )}
      </div>
    </Layout>
  );
}
