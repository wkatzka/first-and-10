import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { checkUsername, login } from '../lib/api';

const DISPLAY_FONT = { fontFamily: 'var(--f10-display-font)' };
const ICY_BLUE = '#8FD9FF';

// Animation constants
const CYCLE_PAUSE_MS = 400;
const ARROW_TRAVEL_MS = 3000;

function frayNoise(seed, i) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function drawChalkO(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.globalAlpha = 0.7;
  const r = 10;
  for (let pass = 0; pass < 3; pass++) {
    ctx.beginPath();
    ctx.arc(x + frayNoise(pass, 0) * 1.2, y + frayNoise(pass, 1) * 1.2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawChalkX(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.globalAlpha = 0.7;
  const s = 10;
  for (let pass = 0; pass < 3; pass++) {
    const j1 = frayNoise(pass, 0) * 1.5;
    const j2 = frayNoise(pass, 1) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x - s + j1, y - s + j2);
    ctx.lineTo(x + s - j1, y + s - j2);
    ctx.moveTo(x + s + j2, y - s - j1);
    ctx.lineTo(x - s - j2, y + s + j1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawChalkLine(ctx, points, color) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.globalAlpha = 0.7;
  for (let pass = 0; pass < 4; pass++) {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const jx = frayNoise(pass * 11 + i, 2) * 1.2;
      const jy = frayNoise(pass * 11 + i, 3) * 1.2;
      if (i === 0) ctx.moveTo(p.x + jx, p.y + jy);
      else ctx.lineTo(p.x + jx, p.y + jy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawChalkArrowhead(ctx, tip, angle, color) {
  const size = 16;
  const halfAngle = Math.PI / 4;
  const left = { x: tip.x - size * Math.cos(angle - halfAngle), y: tip.y - size * Math.sin(angle - halfAngle) };
  const right = { x: tip.x - size * Math.cos(angle + halfAngle), y: tip.y - size * Math.sin(angle + halfAngle) };
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.globalAlpha = 0.7;
  for (let pass = 0; pass < 3; pass++) {
    ctx.beginPath();
    ctx.moveTo(left.x + frayNoise(pass, 10) * 1.2, left.y + frayNoise(pass, 11) * 1.2);
    ctx.lineTo(tip.x + frayNoise(pass, 12) * 0.5, tip.y + frayNoise(pass, 13) * 0.5);
    ctx.lineTo(right.x + frayNoise(pass, 14) * 1.2, right.y + frayNoise(pass, 15) * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}

function bezierPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

// Login Animation Component
function LoginAnimation() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const cycleStartRef = useRef(performance.now());
  const playRef = useRef(null);

  const initPlay = useCallback((w, h) => {
    // Boundary padding and shift
    const pad = 30;
    const shiftLeft = 60; // Additional 30px left
    const usableW = w - pad * 2 - shiftLeft;
    
    // Create O's with horizontal variation, pinched together
    const oPositions = [
      { x: pad + usableW * 0.15 + (Math.random() - 0.5) * 30, y: h - 30 },
      { x: pad + usableW * 0.32 + (Math.random() - 0.5) * 30, y: h - 40 },
      { x: pad + usableW * 0.5 + (Math.random() - 0.5) * 30, y: h - 25 },
      { x: pad + usableW * 0.68 + (Math.random() - 0.5) * 30, y: h - 40 },
      { x: pad + usableW * 0.85 + (Math.random() - 0.5) * 30, y: h - 30 },
    ];
    
    // Clamp O positions to boundaries
    oPositions.forEach(o => {
      o.x = Math.max(pad, Math.min(w - pad - shiftLeft, o.x));
    });
    
    // Create X's (defense) higher up, also within boundaries and shifted
    const xPositions = [
      { x: pad + usableW * 0.18 + Math.random() * 20, y: h * 0.4 + Math.random() * 30 },
      { x: pad + usableW * 0.36 + Math.random() * 20, y: h * 0.35 + Math.random() * 30 },
      { x: pad + usableW * 0.5 + Math.random() * 20, y: h * 0.45 + Math.random() * 30 },
      { x: pad + usableW * 0.64 + Math.random() * 20, y: h * 0.35 + Math.random() * 30 },
      { x: pad + usableW * 0.82 + Math.random() * 20, y: h * 0.4 + Math.random() * 30 },
    ];
    
    // Route length (80% of original)
    const routeLen = h * 0.65;
    const curve = 15; // Softness of turns
    
    // Routes with soft turns (add intermediate points for gentle curves)
    const routes = [];
    
    // Route 0: Straight up (go route)
    const o0 = oPositions[0];
    routes.push([
      o0,
      { x: o0.x, y: o0.y - routeLen },
    ]);
    
    // Route 1: 90 degree turn at 50% (out route) - soft curve at turn
    const o1 = oPositions[1];
    const turn1Y = o1.y - routeLen * 0.5;
    routes.push([
      o1,
      { x: o1.x, y: turn1Y + curve },
      { x: o1.x + curve * 0.5, y: turn1Y },
      { x: Math.min(o1.x + routeLen * 0.4, w - pad - shiftLeft), y: turn1Y },
    ]);
    
    // Route 2: Straight up (another go route from center)
    const o2 = oPositions[2];
    routes.push([
      o2,
      { x: o2.x, y: o2.y - routeLen },
    ]);
    
    // Route 3: 45 degree turn at 75% (post route) - soft curve at turn
    const o3 = oPositions[3];
    const turn3Y = o3.y - routeLen * 0.75;
    const postDist = routeLen * 0.25;
    routes.push([
      o3,
      { x: o3.x, y: turn3Y + curve },
      { x: o3.x - curve * 0.35, y: turn3Y - curve * 0.35 },
      { x: Math.max(o3.x - postDist * 0.707, pad), y: turn3Y - postDist * 0.707 },
    ]);
    
    // Route 4: 135 degree turn at 90% (comeback route) - soft curve at turn
    const o4 = oPositions[4];
    const turn4Y = o4.y - routeLen * 0.9;
    const comebackDist = routeLen * 0.15;
    routes.push([
      o4,
      { x: o4.x, y: turn4Y + curve },
      { x: o4.x + curve * 0.35, y: turn4Y + curve * 0.35 },
      { x: Math.min(o4.x + comebackDist * 0.707, w - pad - shiftLeft), y: turn4Y + comebackDist * 0.707 },
    ]);
    
    return { oPositions, xPositions, routes };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      playRef.current = initPlay(rect.width, rect.height);
      cycleStartRef.current = performance.now();
    };
    
    resize();
    window.addEventListener('resize', resize);
    
    const ctx = canvas.getContext('2d');
    const frame = (now) => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      
      const play = playRef.current;
      if (!play) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }
      
      const dt = now - cycleStartRef.current;
      
      // Draw O's
      play.oPositions.forEach(pos => drawChalkO(ctx, pos.x, pos.y, ICY_BLUE));
      
      // Draw X's
      play.xPositions.forEach(pos => drawChalkX(ctx, pos.x, pos.y, ICY_BLUE));
      
      // Draw animated routes (line segments with sharp turns)
      const drawT = Math.min(1, (dt - CYCLE_PAUSE_MS) / ARROW_TRAVEL_MS);
      const eased = drawT < 0 ? 0 : drawT < 0.5 ? 4 * drawT * drawT * drawT : 1 - Math.pow(-2 * drawT + 2, 3) / 2;
      
      play.routes.forEach((routePoints) => {
        if (routePoints.length < 2) return;
        
        // Calculate total route length
        let totalLen = 0;
        const segLens = [];
        for (let i = 1; i < routePoints.length; i++) {
          const dx = routePoints[i].x - routePoints[i-1].x;
          const dy = routePoints[i].y - routePoints[i-1].y;
          const len = Math.sqrt(dx * dx + dy * dy);
          segLens.push(len);
          totalLen += len;
        }
        
        // How far along the route to draw
        const drawLen = eased * totalLen;
        
        // Build points up to drawLen
        const pts = [routePoints[0]];
        let accumulated = 0;
        
        for (let i = 0; i < segLens.length; i++) {
          const segLen = segLens[i];
          const segStart = routePoints[i];
          const segEnd = routePoints[i + 1];
          
          if (accumulated + segLen <= drawLen) {
            // Full segment
            pts.push(segEnd);
            accumulated += segLen;
          } else {
            // Partial segment
            const remaining = drawLen - accumulated;
            const t = remaining / segLen;
            pts.push({
              x: segStart.x + (segEnd.x - segStart.x) * t,
              y: segStart.y + (segEnd.y - segStart.y) * t,
            });
            break;
          }
        }
        
        if (pts.length >= 2) {
          drawChalkLine(ctx, pts, ICY_BLUE);
          const tip = pts[pts.length - 1];
          const prev = pts[pts.length - 2];
          drawChalkArrowhead(ctx, tip, Math.atan2(tip.y - prev.y, tip.x - prev.x), ICY_BLUE);
        }
      });
      
      // Reset cycle
      if (dt > CYCLE_PAUSE_MS + ARROW_TRAVEL_MS + 800) {
        cycleStartRef.current = now;
        playRef.current = initPlay(w, h);
      }
      
      rafRef.current = requestAnimationFrame(frame);
    };
    
    rafRef.current = requestAnimationFrame(frame);
    
    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [initPlay]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '45vh',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  );
}

export default function Home({ user, onLogin }) {
  const [step, setStep] = useState('username');
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
      router.push('/team');
    }
  }, [user, router]);
  
  const handleCheckUsername = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setError('');
    setLoading(true);
    
    try {
      const result = await checkUsername(username.trim());
      
      if (result.status === 'exists') {
        setStep('password');
        setMessage('Welcome back! Enter your password.');
      } else if (result.status === 'preregistered') {
        setStep('newuser');
        setMessage(result.message);
        setMaxPacks(result.maxPacks || 8);
        setTeamName(`${username}'s Team`);
      } else {
        setError('Username not found. This is an invite-only beta.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
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

  const buttonStyle = {
    background: `${ICY_BLUE}25`,
    border: `2px solid ${ICY_BLUE}`,
    boxShadow: `0 0 20px ${ICY_BLUE}50`,
    ...DISPLAY_FONT,
  };
  
  return (
    <div className="min-h-screen min-h-screen-mobile flex flex-col items-center justify-start px-4 relative z-10" style={{ paddingTop: 'calc(18vh + 63px)' }}>
      {/* Login Animation at bottom */}
      <LoginAnimation />
      
      {/* Auth Card */}
      <div className="w-full max-w-sm">
        <div className="f10-panel p-6">
          
          {/* Step 1: Enter Username */}
          {step === 'username' && (
            <form onSubmit={handleCheckUsername}>
              <div className="text-center mb-6">
                <h2 className="text-xl text-white" style={DISPLAY_FONT}>Enter Your Username</h2>
                <p className="text-sm text-gray-500 mt-1" style={DISPLAY_FONT}>Invite-only beta</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 f10-input text-white focus:outline-none text-lg rounded-xl"
                    style={{ ...DISPLAY_FONT, backgroundColor: 'rgba(0,0,0,0.4)', border: `1px solid ${ICY_BLUE}30` }}
                    placeholder="Username"
                    autoFocus
                    required
                  />
                </div>
                
                {error && (
                  <div className="text-red-400 text-sm text-center" style={DISPLAY_FONT}>{error}</div>
                )}
                
                <button
                  type="submit"
                  disabled={loading || !username.trim()}
                  className="w-full py-3.5 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                  style={buttonStyle}
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
                <h2 className="text-xl text-white" style={DISPLAY_FONT}>Welcome back, {username}!</h2>
                {message && <p className="text-sm mt-1" style={{ ...DISPLAY_FONT, color: ICY_BLUE }}>{message}</p>}
              </div>
              
              <div className="space-y-4">
                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 f10-input text-white focus:outline-none rounded-xl"
                    style={{ ...DISPLAY_FONT, backgroundColor: 'rgba(0,0,0,0.4)', border: `1px solid ${ICY_BLUE}30` }}
                    placeholder="Password"
                    autoFocus
                    required
                  />
                </div>
                
                {error && (
                  <div className="text-red-400 text-sm text-center" style={DISPLAY_FONT}>{error}</div>
                )}
                
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full py-3.5 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                  style={buttonStyle}
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
                
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full py-2 text-gray-400 hover:text-white transition-colors"
                  style={DISPLAY_FONT}
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
                <h2 className="text-xl text-white" style={DISPLAY_FONT}>Welcome, {username}!</h2>
                {message && <p className="text-sm mt-1" style={{ ...DISPLAY_FONT, color: ICY_BLUE }}>{message}</p>}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1" style={DISPLAY_FONT}>Create Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 f10-input text-white focus:outline-none rounded-xl"
                    style={{ ...DISPLAY_FONT, backgroundColor: 'rgba(0,0,0,0.4)', border: `1px solid ${ICY_BLUE}30` }}
                    placeholder="Choose a password"
                    autoFocus
                    required
                    minLength={4}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1" style={DISPLAY_FONT}>Team Name</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full px-4 py-3 f10-input text-white focus:outline-none rounded-xl"
                    style={{ ...DISPLAY_FONT, backgroundColor: 'rgba(0,0,0,0.4)', border: `1px solid ${ICY_BLUE}30` }}
                    placeholder="Name your team"
                    maxLength={30}
                  />
                  <p className="text-xs text-gray-500 mt-1" style={DISPLAY_FONT}>You can change this later</p>
                </div>
                
                {error && (
                  <div className="text-red-400 text-sm text-center" style={DISPLAY_FONT}>{error}</div>
                )}
                
                <button
                  type="submit"
                  disabled={loading || !password || password.length < 4}
                  className="w-full py-3.5 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                  style={buttonStyle}
                >
                  {loading ? 'Creating account...' : 'Start Playing!'}
                </button>
                
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full py-2 text-gray-400 hover:text-white transition-colors"
                  style={DISPLAY_FONT}
                >
                  ← Back
                </button>
              </div>
              
              {/* Bonus Info */}
              <div className="mt-6 p-4 rounded-2xl" style={{ background: `${ICY_BLUE}10`, border: `1px solid ${ICY_BLUE}30` }}>
                <div className="font-semibold mb-1" style={{ ...DISPLAY_FONT, color: ICY_BLUE }}>
                  Your Welcome Bonus!
                </div>
                <div className="text-sm text-gray-300" style={DISPLAY_FONT}>
                  You'll receive <span className="text-white font-bold">{maxPacks} free packs</span> ({maxPacks * 5} cards)!
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
