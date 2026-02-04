/**
 * ChalkPlayDiagram – Static play diagram under My Roster (Offense / Defense).
 * "First & 10" end zone at top; viewport-only; chalk-style circles, X's, and arrows.
 * Color scheme matches PlayfieldBackground (icy/neon on dark field).
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';

const COLORS = {
  field: '#06080A',
  icy: '#8FD9FF',
  icyBright: '#C7EEFF',
  chalk: 'rgba(199, 238, 255, 0.92)',
  chalkDim: 'rgba(143, 217, 255, 0.65)',
};
const BG_DIM = 0.62;
const PX_PER_YARD = 14;
const ENDZONE_YARDS = 10;
const FIELD_VISIBLE_YARDS = 35; // from goal line down; fits phone
const CHALK_STROKE = 2.5;
const CARD_R = 22;
const X_SIZE = 12;

// Seeded noise for repeatable "fray" offsets
function frayNoise(seed, i) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function drawChalkCircle(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = CHALK_STROKE;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.globalAlpha = BG_DIM;
  // Frayed edge: multiple strokes with small random offsets
  for (let pass = 0; pass < 5; pass++) {
    ctx.beginPath();
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const jitter = 1.5 * frayNoise(pass * 7 + 1, i);
      const x = cx + (r + jitter) * Math.cos(t);
      const y = cy + (r + jitter) * Math.sin(t);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawChalkX(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = CHALK_STROKE;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.globalAlpha = BG_DIM;
  const s = X_SIZE;
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

function drawChalkLine(ctx, points, color, flatEnd = false) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = CHALK_STROKE;
  ctx.lineCap = flatEnd ? 'butt' : 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.globalAlpha = BG_DIM;
  for (let pass = 0; pass < 4; pass++) {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const jx = frayNoise(pass * 11 + i, 2) * 1.2;
      const jy = frayNoise(pass * 11 + i, 3) * 1.2;
      const x = p.x + jx;
      const y = p.y + jy;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawChalkArrowhead(ctx, tip, angle, color) {
  const size = 10;
  const left = {
    x: tip.x - size * Math.cos(angle - 0.45),
    y: tip.y - size * Math.sin(angle - 0.45),
  };
  const right = {
    x: tip.x - size * Math.cos(angle + 0.45),
    y: tip.y - size * Math.sin(angle + 0.45),
  };
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = CHALK_STROKE;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.globalAlpha = BG_DIM;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();
  ctx.restore();
}

function bezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const uu = u * u, uuu = uu * u;
  const tt = t * t, ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function bezierTangent(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

// Route builders (offense): different shapes for WR, TE, RB, WR
function buildSlant(p0, endY) {
  const p3 = { x: p0.x + 30, y: p0.y - endY };
  const p1 = { x: p0.x + (p3.x - p0.x) * 0.35, y: p0.y + (p3.y - p0.y) * 0.35 };
  const p2 = { x: p0.x + (p3.x - p0.x) * 0.7, y: p0.y + (p3.y - p0.y) * 0.7 };
  return { p0, p1, p2, p3 };
}
function buildPost(p0, endY, centerX) {
  const p3 = { x: p0.x + (centerX - p0.x) * 0.6, y: p0.y - endY };
  const p1 = { x: p0.x + (p3.x - p0.x) * 0.3, y: p0.y + (p3.y - p0.y) * 0.35 };
  const p2 = { x: p0.x + (p3.x - p0.x) * 0.7, y: p0.y + (p3.y - p0.y) * 0.75 };
  return { p0, p1, p2, p3 };
}
function buildFlag(p0, endY, centerX) {
  const side = p0.x >= centerX ? 1 : -1;
  const p3 = { x: p0.x + side * 80, y: p0.y - endY * 0.8 };
  const p1 = { x: p0.x + (p3.x - p0.x) * 0.3, y: p0.y + (p3.y - p0.y) * 0.35 };
  const p2 = { x: p0.x + (p3.x - p0.x) * 0.7, y: p0.y + (p3.y - p0.y) * 0.75 };
  return { p0, p1, p2, p3 };
}
function buildButtonhook(p0, endY) {
  const p3 = { x: p0.x - 20, y: p0.y - endY * 0.6 };
  const midY = p0.y - endY * 0.4;
  const p1 = { x: p0.x + 25, y: midY };
  const p2 = { x: p3.x + 30, y: midY };
  return { p0, p1, p2, p3 };
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const OFFENSE_ROUTE_BUILDERS = [buildSlant, buildPost, buildFlag, buildButtonhook];
const ARROW_TRAVEL_MS = 3200;
const CYCLE_PAUSE_MS = 800;

export default function ChalkPlayDiagram({ mode, width, height }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 400, h: 320 });
  const cycleStartRef = useRef(performance.now());
  const playRef = useRef({ xPositions: [], routes: [], xCoords: [] });
  const rafRef = useRef(null);

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSize({ w: rect.width, h: Math.min(rect.height, typeof window !== 'undefined' ? window.innerHeight * 0.55 : 380) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const { w, h } = size;
  const endzoneH = ENDZONE_YARDS * PX_PER_YARD;
  const goalLineY = endzoneH;
  const line10Y = goalLineY + 10 * PX_PER_YARD;

  const initOffensePlay = useCallback(() => {
    const margin = 0.12;
    const step = (1 - 2 * margin) / 4;
    const centerX = w / 2;
    const positions = ['WR', 'TE', 'DB', 'RB', 'WR'];
    const xPositions = positions.map((_, i) => ({
      x: w * (margin + i * step),
      y: line10Y,
      label: positions[i],
    }));
    const qbX = w * (margin + 2 * step);
    const qb = { x: qbX, y: line10Y + PX_PER_YARD * 4, label: 'QB' };
    const arrowIndices = [0, 1, 3, 4];
    const routeOrder = shuffle([0, 1, 2, 3]);
    const routes = arrowIndices.map((idx, i) => {
      const p0 = { x: xPositions[idx].x, y: xPositions[idx].y };
      const endY = 80 + Math.random() * 60;
      const build = OFFENSE_ROUTE_BUILDERS[routeOrder[i]];
      return build(p0, endY, centerX);
    });
    const xCoords = [
      { x: w * 0.25 + (Math.random() - 0.5) * 60, y: line10Y - 50 - Math.random() * 40 },
      { x: w * 0.5 + (Math.random() - 0.5) * 80, y: line10Y - 70 - Math.random() * 50 },
      { x: w * 0.75 + (Math.random() - 0.5) * 60, y: line10Y - 45 - Math.random() * 45 },
    ];
    return { xPositions: [...xPositions, qb], routes, xCoords };
  }, [w, line10Y]);

  const initDefensePlay = useCallback(() => {
    const margin = 0.14;
    const step = (1 - 2 * margin) / 3;
    const positions = ['DB', 'DL', 'LB', 'DB'];
    const xPositions = positions.map((_, i) => ({
      x: w * (margin + i * step),
      y: line10Y,
      label: positions[i],
    }));
    const kX = w * (margin + 1.5 * step);
    const k = { x: kX, y: line10Y + PX_PER_YARD * 4, label: 'K' };
    const xCoords = [
      { x: w * 0.2 + Math.random() * w * 0.15, y: goalLineY + PX_PER_YARD * 3 + Math.random() * 40 },
      { x: w * 0.4 + Math.random() * w * 0.2, y: goalLineY + PX_PER_YARD * 4 + Math.random() * 35 },
      { x: w * 0.6 + Math.random() * w * 0.2, y: goalLineY + PX_PER_YARD * 3.5 + Math.random() * 40 },
      { x: w * 0.8 + Math.random() * w * 0.15, y: goalLineY + PX_PER_YARD * 3 + Math.random() * 35 },
    ];
    return { xPositions: [...xPositions, k], routes: null, xCoords };
  }, [w, line10Y, goalLineY]);

  useEffect(() => {
    cycleStartRef.current = performance.now();
    if (mode === 'offense') {
      playRef.current = initOffensePlay();
    } else {
      playRef.current = initDefensePlay();
    }
  }, [mode, w, h, initOffensePlay, initDefensePlay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const drawStaticField = () => {
      ctx.fillStyle = COLORS.field;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = COLORS.icy;
      ctx.shadowColor = COLORS.icy;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.55 * BG_DIM;
      const xStart = 20;
      const xEnd = w - 20;
      for (let yard = 0; yard <= FIELD_VISIBLE_YARDS; yard += 5) {
        const yPx = endzoneH + yard * PX_PER_YARD;
        if (yPx > h) break;
        const isGoal = yard === 0;
        const is10 = yard === 10;
        let segStart = xStart;
        let segEnd = xEnd;
        if (yard === 0) {
          const pad = 80;
          segStart = w / 2 - 160 - pad;
          segEnd = w / 2 + 160 + pad;
          if (segStart > xStart) {
            ctx.beginPath();
            ctx.moveTo(xStart, yPx);
            ctx.lineTo(segStart, yPx);
            ctx.stroke();
          }
          if (segEnd < xEnd) {
            ctx.beginPath();
            ctx.moveTo(segEnd, yPx);
            ctx.lineTo(xEnd, yPx);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.moveTo(segStart, yPx);
        ctx.lineTo(segEnd, yPx);
        ctx.stroke();
        if (yard <= 10) {
          for (let i = 4; i < 12; i++) {
            const yy = yPx + i * 4;
            ctx.beginPath();
            ctx.moveTo(10, yy);
            ctx.lineTo(14, yy);
            ctx.moveTo(w - 14, yy);
            ctx.lineTo(w - 10, yy);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
      ctx.save();
      ctx.fillStyle = COLORS.icyBright;
      ctx.shadowColor = COLORS.icy;
      ctx.shadowBlur = 12;
      ctx.font = 'bold 32px CollegeBlock, Graduate, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FIRST & 10', w / 2, endzoneH / 2);
      ctx.restore();
    };

    const frame = (now) => {
      const play = playRef.current;
      const dt = now - cycleStartRef.current;

      drawStaticField();

      const color = COLORS.chalk;

      if (mode === 'offense' && play.routes) {
        play.xPositions.forEach((pos) => {
          drawChalkCircle(ctx, pos.x, pos.y, CARD_R, color);
          ctx.save();
          ctx.fillStyle = color;
          ctx.font = '11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = BG_DIM;
          ctx.fillText(pos.label, pos.x, pos.y);
          ctx.restore();
        });
        play.xCoords.forEach((xc) => drawChalkX(ctx, xc.x, xc.y, color));

        const drawT = Math.min(1, (dt - CYCLE_PAUSE_MS) / ARROW_TRAVEL_MS);
        const eased = drawT < 0 ? 0 : drawT < 0.5 ? 4 * drawT * drawT * drawT : 1 - Math.pow(-2 * drawT + 2, 3) / 2;
        play.routes.forEach((r) => {
          const segments = 80;
          const endI = Math.ceil(eased * segments);
          const pts = [];
          for (let i = 0; i <= endI; i++) {
            const t = i / segments;
            pts.push(bezierPoint(r.p0, r.p1, r.p2, r.p3, t));
          }
          if (pts.length >= 2) drawChalkLine(ctx, pts, color, false);
          if (eased >= 0.98 && pts.length >= 2) {
            const tip = pts[pts.length - 1];
            const prev = pts[pts.length - 2];
            const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
            drawChalkArrowhead(ctx, tip, angle, color);
          }
        });

        if (dt > CYCLE_PAUSE_MS + ARROW_TRAVEL_MS + 600) {
          cycleStartRef.current = now;
          playRef.current = initOffensePlay();
        }
      } else if (mode === 'defense' && play.xCoords) {
        play.xPositions.forEach((pos) => {
          drawChalkCircle(ctx, pos.x, pos.y, CARD_R, color);
          ctx.save();
          ctx.fillStyle = color;
          ctx.font = '11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = BG_DIM;
          ctx.fillText(pos.label, pos.x, pos.y);
          ctx.restore();
        });
        play.xCoords.forEach((xc) => drawChalkX(ctx, xc.x, xc.y, color));
        const fourCards = play.xPositions.slice(0, 4);
        fourCards.forEach((pos, i) => {
          const xc = play.xCoords[i];
          const pts = [{ x: pos.x, y: pos.y }, { x: xc.x, y: xc.y }];
          drawChalkLine(ctx, pts, color, true);
        });

        if (dt > 4000) {
          cycleStartRef.current = now;
          playRef.current = initDefensePlay();
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [w, h, mode, initOffensePlay, initDefensePlay, goalLineY, endzoneH, line10Y]);

  return (
    <div ref={containerRef} className="w-full" style={{ height: 'min(55vh, 400px)' }}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="w-full h-full rounded-xl overflow-hidden border border-white/10"
        style={{
          width: w,
          height: h,
          background: COLORS.field,
        }}
      />
    </div>
  );
}
