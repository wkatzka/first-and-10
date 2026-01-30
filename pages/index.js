import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { checkUsername, login } from '../lib/api';

export default function Home({ user, onLogin }) {
  const [step, setStep] = useState('username'); // 'username', 'password', 'newuser'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [maxPacks, setMaxPacks] = useState(8);
  const router = useRouter();
  
  useEffect(() => {
    if (user) {
      router.push('/cards');
    }
  }, [user, router]);
  
  // Check username status
  const handleCheckUsername = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setError('');
    setLoading(true);
    
    try {
      const result = await checkUsername(username.trim());
      
      if (result.status === 'exists') {
        // Existing user - just need password
        setStep('password');
        setMessage('Welcome back! Enter your password.');
      } else if (result.status === 'preregistered') {
        // Pre-registered - need password + team name
        setStep('newuser');
        setMessage(result.message);
        setMaxPacks(result.maxPacks || 8);
        setTeamName(`${username}'s Team`);
      } else {
        // Not found
        setError('Username not found. This is an invite-only beta. Contact the admin for access.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Login or claim account
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const data = await login(
        username.trim(), 
        password, 
        step === 'newuser' ? teamName : null
      );
      
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleBack = () => {
    setStep('username');
    setPassword('');
    setTeamName('');
    setError('');
    setMessage('');
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
          
          {/* Step 1: Enter Username */}
          {step === 'username' && (
            <form onSubmit={handleCheckUsername}>
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white">Enter Your Username</h2>
                <p className="text-sm text-gray-400 mt-1">Invite-only beta</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                    placeholder="Enter your username"
                    autoFocus
                    required
                  />
                </div>
                
                {error && (
                  <div className="text-red-400 text-sm text-center">{error}</div>
                )}
                
                <button
                  type="submit"
                  disabled={loading || !username.trim()}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Checking...' : 'Continue'}
                </button>
              </div>
            </form>
          )}
          
          {/* Step 2: Existing User - Password Only */}
          {step === 'password' && (
            <form onSubmit={handleLogin}>
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white">Welcome back, {username}!</h2>
                {message && <p className="text-sm text-green-400 mt-1">{message}</p>}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your password"
                    autoFocus
                    required
                  />
                </div>
                
                {error && (
                  <div className="text-red-400 text-sm text-center">{error}</div>
                )}
                
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
                
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full py-2 text-gray-400 hover:text-white transition-colors"
                >
                  ← Back
                </button>
              </div>
            </form>
          )}
          
          {/* Step 3: New User - Password + Team Name */}
          {step === 'newuser' && (
            <form onSubmit={handleLogin}>
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white">Welcome, {username}!</h2>
                {message && <p className="text-sm text-green-400 mt-1">{message}</p>}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Create Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Choose a password"
                    autoFocus
                    required
                    minLength={4}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Team Name</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Name your team"
                    maxLength={30}
                  />
                  <p className="text-xs text-gray-500 mt-1">You can change this later</p>
                </div>
                
                {error && (
                  <div className="text-red-400 text-sm text-center">{error}</div>
                )}
                
                <button
                  type="submit"
                  disabled={loading || !password || password.length < 4}
                  className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating account...' : 'Start Playing!'}
                </button>
                
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full py-2 text-gray-400 hover:text-white transition-colors"
                >
                  ← Back
                </button>
              </div>
              
              {/* Bonus Info */}
              <div className="mt-6 p-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-lg border border-yellow-600/30">
                <div className="text-yellow-400 font-semibold mb-1">
                  Your Welcome Bonus!
                </div>
                <div className="text-sm text-gray-300">
                  You'll receive <span className="text-white font-bold">{maxPacks} free packs</span> ({maxPacks * 5} cards)!
                </div>
              </div>
            </form>
          )}
        </div>
        
        {/* Games Start Monday Banner */}
        <div className="mt-6 p-4 bg-gradient-to-r from-green-900/50 to-emerald-900/50 rounded-xl border border-green-500/30 text-center">
          <div className="text-2xl mb-1">🏈</div>
          <div className="text-green-400 font-bold text-lg">Games Start Monday!</div>
          <div className="text-sm text-gray-300">Get your roster ready before 7 PM EST</div>
        </div>
        
        {/* Features */}
        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
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
        
        {/* How to Play Link */}
        <div className="mt-6 text-center">
          <Link 
            href="/how-to-play"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors border border-gray-600"
          >
            <span>📖</span>
            <span>How to Play</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
