import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { register, login } from '../lib/api';

export default function Home({ user, onLogin }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    if (user) {
      router.push('/cards');
    }
  }, [user, router]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const data = mode === 'login' 
        ? await login(username, password)
        : await register(username, password);
      
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen min-h-screen-mobile bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">🏈</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">First & 10</h1>
          <p className="text-gray-400 text-sm sm:text-base">Build your dream team. Compete head-to-head.</p>
        </div>
        
        {/* Auth Card */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-2xl">
          {/* Tabs */}
          <div className="flex mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-center font-semibold transition-colors ${
                mode === 'login'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-center font-semibold transition-colors ${
                mode === 'register'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password"
                  required
                />
              </div>
              
              {error && (
                <div className="text-red-400 text-sm text-center">{error}</div>
              )}
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 touch-target"
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
              </button>
            </div>
          </form>
          
          {/* Bonus Info */}
          {mode === 'register' && (
            <div className="mt-6 p-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-lg border border-yellow-600/30">
              <div className="text-yellow-400 font-semibold mb-1">
                New Player Bonus!
              </div>
              <div className="text-sm text-gray-300">
                Get <span className="text-white font-bold">8 free packs</span> (40 cards) when you sign up!
              </div>
              <div className="text-xs text-gray-400 mt-1">
                3 Starter Packs + 5 Bonus Packs
              </div>
            </div>
          )}
        </div>
        
        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl mb-1">📦</div>
            <div className="text-xs text-gray-400">Open Packs</div>
          </div>
          <div>
            <div className="text-2xl mb-1">👥</div>
            <div className="text-xs text-gray-400">Build Teams</div>
          </div>
          <div>
            <div className="text-2xl mb-1">⚔️</div>
            <div className="text-xs text-gray-400">Compete</div>
          </div>
        </div>
      </div>
    </div>
  );
}
