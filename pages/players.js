import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import Card from '../components/Card';
import CardModal from '../components/CardModal';
import { getAllUsers, getUserCards } from '../lib/api';

export default function Players({ user, onLogout }) {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userCards, setUserCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    loadUsers();
  }, [user, router]);
  
  const loadUsers = async () => {
    try {
      const data = await getAllUsers();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const viewUserCards = async (targetUser) => {
    setSelectedUser(targetUser);
    setLoadingCards(true);
    setUserCards([]);
    
    try {
      const data = await getUserCards(targetUser.id);
      setUserCards(data.cards || []);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setLoadingCards(false);
    }
  };
  
  const closeUserCards = () => {
    setSelectedUser(null);
    setUserCards([]);
  };
  
  if (!user) return null;
  
  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Players</h1>
          <p className="text-gray-400">Browse other players' card collections</p>
        </div>
        
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading players...</div>
        ) : users.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No other players yet. Invite some friends!
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {users.map(u => (
              <div
                key={u.id}
                className={`bg-gray-800 rounded-xl p-4 ${
                  u.id === user.id ? 'border-2 border-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {u.username}
                      {u.id === user.id && (
                        <span className="ml-2 text-xs text-blue-400">(You)</span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-400">{u.team_name || 'No team name'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{u.card_count}</div>
                    <div className="text-xs text-gray-500">cards</div>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="flex gap-4 text-sm mb-3">
                  <div className="text-center">
                    <div className="text-green-400 font-bold">{u.stats?.wins || 0}</div>
                    <div className="text-xs text-gray-500">Wins</div>
                  </div>
                  <div className="text-center">
                    <div className="text-red-400 font-bold">{u.stats?.losses || 0}</div>
                    <div className="text-xs text-gray-500">Losses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-400 font-bold">{u.stats?.ties || 0}</div>
                    <div className="text-xs text-gray-500">Ties</div>
                  </div>
                </div>
                
                <button
                  onClick={() => viewUserCards(u)}
                  disabled={u.card_count === 0}
                  className="w-full py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {u.card_count === 0 ? 'No Cards Yet' : 'View Collection'}
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* User Cards Modal */}
        {selectedUser && (
          <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
            onClick={closeUserCards}
          >
            <div 
              className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {selectedUser.username}'s Collection
                  </h2>
                  <p className="text-sm text-gray-400">
                    {selectedUser.team_name} · {userCards.length} cards
                  </p>
                </div>
                <button
                  onClick={closeUserCards}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              
              {loadingCards ? (
                <div className="text-center text-gray-400 py-8">Loading cards...</div>
              ) : userCards.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No cards in collection
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {userCards
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
