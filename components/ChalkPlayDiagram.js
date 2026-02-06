/**
 * ChalkPlayDiagram – Roster cards on the field under My Roster.
 * "First & 10" end zone at top; chalk X's and arrows (neon colors); real MiniCards on field.
 * No panel wrapper – cards sit directly on the field.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MiniCard } from './Card';

const COLORS = {
  field: '#06080A',
  icy: '#8FD9FF',
  icyBright: '#C7EEFF',
};
const NEON = ['#4CCBFF', '#4AA3FF', '#6CFF3E', '#FF4FA3', '#FF9A2E'];
const BG_DIM = 0.62;
// Match StaticFieldBackground so cards/arrows align with background field
const PX_PER_YARD = 18;
const ENDZONE_YARDS = 10;
const CHALK_STROKE = 2.5;
const X_SIZE = 12;
const CARD_W = 78;
const CARD_H = 92;
const NAME_HEIGHT = 14; // Height of player name text shown below each card

// Offense: WR1, TE, OL, RB, WR2 + QB behind OL. Slot ids for roster.cards.
const OFFENSE_SLOTS = ['wr1_card_id', 'te_card_id', 'ol_card_id', 'rb_card_id', 'wr2_card_id'];
const OFFENSE_QB_SLOT = 'qb_card_id';
const DEFENSE_SLOTS = ['db1_card_id', 'dl_card_id', 'lb_card_id', 'db2_card_id'];
const DEFENSE_K_SLOT = 'k_card_id';

// For onSlotClick: slot id -> position (used by card picker modal).
const SLOT_TO_POSITION = {
  wr1_card_id: 'WR',
  te_card_id: 'TE',
  ol_card_id: 'OL',
  rb_card_id: 'RB',
  wr2_card_id: 'WR',
  qb_card_id: 'QB',
  db1_card_id: 'DB',
  dl_card_id: 'DL',
  lb_card_id: 'LB',
  db2_card_id: 'DB',
  k_card_id: 'K',
};

function frayNoise(seed, i) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
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
      if (i === 0) ctx.moveTo(p.x + jx, p.y + jy);
      else ctx.lineTo(p.x + jx, p.y + jy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Arrowhead: twice as big, right angle (π/2 total = 0.5 rad each side from tip direction)
function drawChalkArrowhead(ctx, tip, angle, color) {
  const size = 20;
  const halfAngle = Math.PI / 4; // 45° each side = 90° total
  const left = { x: tip.x - size * Math.cos(angle - halfAngle), y: tip.y - size * Math.sin(angle - halfAngle) };
  const right = { x: tip.x - size * Math.cos(angle + halfAngle), y: tip.y - size * Math.sin(angle + halfAngle) };
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

// Flat head: twice as long (16), perpendicular bar at tip
function drawChalkFlatHead(ctx, tip, angle, color) {
  const size = 16;
  const perp = { x: -Math.sin(angle), y: Math.cos(angle) };
  const left = { x: tip.x - perp.x * size, y: tip.y - perp.y * size };
  const right = { x: tip.x + perp.x * size, y: tip.y + perp.y * size };
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = CHALK_STROKE;
  ctx.lineCap = 'butt';
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.globalAlpha = BG_DIM;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
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

function buildSlant(p0, endY) {
  const p3 = { x: p0.x + 30, y: p0.y - endY };
  return { p0, p1: { x: p0.x + (p3.x - p0.x) * 0.35, y: p0.y + (p3.y - p0.y) * 0.35 }, p2: { x: p0.x + (p3.x - p0.x) * 0.7, y: p0.y + (p3.y - p0.y) * 0.7 }, p3 };
}
function buildPost(p0, endY, centerX) {
  const p3 = { x: p0.x + (centerX - p0.x) * 0.6, y: p0.y - endY };
  return { p0, p1: { x: p0.x + (p3.x - p0.x) * 0.3, y: p0.y + (p3.y - p0.y) * 0.35 }, p2: { x: p0.x + (p3.x - p0.x) * 0.7, y: p0.y + (p3.y - p0.y) * 0.75 }, p3 };
}
function buildFlag(p0, endY, centerX) {
  const side = p0.x >= centerX ? 1 : -1;
  const p3 = { x: p0.x + side * 80, y: p0.y - endY * 0.8 };
  return { p0, p1: { x: p0.x + (p3.x - p0.x) * 0.3, y: p0.y + (p3.y - p0.y) * 0.35 }, p2: { x: p0.x + (p3.x - p0.x) * 0.7, y: p0.y + (p3.y - p0.y) * 0.75 }, p3 };
}
function buildButtonhook(p0, endY) {
  const p3 = { x: p0.x - 20, y: p0.y - endY * 0.6 };
  const midY = p0.y - endY * 0.4;
  return { p0, p1: { x: p0.x + 25, y: midY }, p2: { x: p3.x + 30, y: midY }, p3 };
}
const OFFENSE_ROUTE_BUILDERS = [buildSlant, buildPost, buildFlag, buildButtonhook];

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const ARROW_TRAVEL_MS = 3200;
const CYCLE_PAUSE_MS = 800;

export default function ChalkPlayDiagram({ mode, roster, onSlotClick, tierInfo }) {
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 400, h: 320 });
  const cycleStartRef = useRef(performance.now());
  const playRef = useRef({ cardPositions: [], routes: [], routeColors: [], xCoords: [] });
  const rafRef = useRef(null);

  useEffect(() => {
    const measure = () => {
      setSize({
        w: typeof window !== 'undefined' ? window.innerWidth : 400,
        h: typeof window !== 'undefined' ? window.innerHeight : 320,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const { w, h } = size;
  const endzoneH = ENDZONE_YARDS * PX_PER_YARD;
  const goalLineY = endzoneH;
  const line10Y = goalLineY + 10 * PX_PER_YARD;

  // Stable card positions for overlay (same layout as play init)
  const cardLayout = React.useMemo(() => {
    if (w <= 0) return [];
    if (mode === 'offense') {
      const margin = 0.08;
      const step = (1 - 2 * margin) / 4;
      // Upside-down U shape: outer cards (WR1, WR2) lower, middle cards higher
      const yOffsets = [28, 6, -8, 6, 28]; // WR1, TE, OL, RB, WR2 (positive = lower on screen)
      const positions = OFFENSE_SLOTS.map((slotId, i) => ({
        slotId,
        x: w * (margin + i * step),
        y: line10Y + yOffsets[i],
        label: { wr1_card_id: 'WR1', te_card_id: 'TE', ol_card_id: 'OL', rb_card_id: 'RB', wr2_card_id: 'WR2' }[slotId],
      }));
      const qbX = w * (margin + 2 * step);
      // QB moved down by NAME_HEIGHT to account for name text below card
      return [...positions, { slotId: OFFENSE_QB_SLOT, x: qbX, y: line10Y + PX_PER_YARD * 4 + NAME_HEIGHT, label: 'QB' }];
    }
    const marginD = 0.1;
    const stepD = (1 - 2 * marginD) / 3;
    // Defense: stagger end cards (DB1 and DB2) lower to avoid blocking sideline "10"
    const yOffsets = [22, 0, 0, 22]; // DB1, DL, LB, DB2 - end cards lower
    const positions = DEFENSE_SLOTS.map((slotId, i) => ({
      slotId,
      x: w * (marginD + i * stepD),
      y: line10Y + yOffsets[i],
      label: { db1_card_id: 'DB1', dl_card_id: 'DL', lb_card_id: 'LB', db2_card_id: 'DB2' }[slotId],
    }));
    const kX = w * (marginD + 1.5 * stepD);
    // K moved down by NAME_HEIGHT to account for name text below card
    return [...positions, { slotId: DEFENSE_K_SLOT, x: kX, y: line10Y + PX_PER_YARD * 4 + NAME_HEIGHT, label: 'K' }];
  }, [w, mode, line10Y]);

  const initOffensePlay = useCallback(() => {
    const margin = 0.08;
    const step = (1 - 2 * margin) / 4;
    const centerX = w / 2;
    // Upside-down U shape: outer cards (WR1, WR2) slightly lower, middle cards higher
    const yOffsets = [18, 0, -8, 0, 18];
    const positions = OFFENSE_SLOTS.map((slotId, i) => ({
      slotId,
      x: w * (margin + i * step),
      y: line10Y + yOffsets[i],
      label: { wr1_card_id: 'WR1', te_card_id: 'TE', ol_card_id: 'OL', rb_card_id: 'RB', wr2_card_id: 'WR2' }[slotId],
    }));
    const qb = { slotId: OFFENSE_QB_SLOT, x: w * (margin + 2 * step), y: line10Y + PX_PER_YARD * 4 + NAME_HEIGHT, label: 'QB' };
    const cardPositions = [...positions, qb];
    const arrowIndices = [0, 1, 3, 4];
    const routeOrder = shuffle([0, 1, 2, 3]);
    const routes = arrowIndices.map((idx, i) => {
      const p0 = { x: positions[idx].x, y: positions[idx].y };
      // Arrows can extend into end zone (up to ~endzoneH + 10yd)
      const endY = 100 + Math.random() * (line10Y * 0.5);
      const build = OFFENSE_ROUTE_BUILDERS[routeOrder[i]];
      return build(p0, endY, centerX);
    });
    const routeColors = routes.map((_, i) => NEON[i % NEON.length]);
    const xCoords = [
      { x: w * 0.2 + (Math.random() - 0.5) * 50, y: line10Y - 45 - Math.random() * 35 },
      { x: w * 0.35 + (Math.random() - 0.5) * 40, y: line10Y - 65 - Math.random() * 45 },
      { x: w * 0.5 + (Math.random() - 0.5) * 60, y: line10Y - 55 - Math.random() * 50 },
      { x: w * 0.65 + (Math.random() - 0.5) * 40, y: line10Y - 70 - Math.random() * 40 },
      { x: w * 0.8 + (Math.random() - 0.5) * 50, y: line10Y - 48 - Math.random() * 42 },
    ];
    return { cardPositions, routes, routeColors, xCoords };
  }, [w, line10Y]);

  const initDefensePlay = useCallback(() => {
    const margin = 0.1;
    const step = (1 - 2 * margin) / 3;
    // Defense: stagger end cards (DB1 and DB2) slightly
    const yOffsets = [12, 0, 0, 12];
    const positions = DEFENSE_SLOTS.map((slotId, i) => ({
      slotId,
      x: w * (margin + i * step),
      y: line10Y + yOffsets[i],
      label: { db1_card_id: 'DB1', dl_card_id: 'DL', lb_card_id: 'LB', db2_card_id: 'DB2' }[slotId],
    }));
    const kX = w * (margin + 1.5 * step);
    const k = { slotId: DEFENSE_K_SLOT, x: kX, y: line10Y + PX_PER_YARD * 4 + NAME_HEIGHT, label: 'K' };
    const cardPositions = [...positions, k];
    const xCoords = [
      { x: w * 0.15 + Math.random() * w * 0.12, y: goalLineY + PX_PER_YARD * 2.5 + Math.random() * 35 },
      { x: w * 0.32 + Math.random() * w * 0.18, y: goalLineY + PX_PER_YARD * 3 + Math.random() * 40 },
      { x: w * 0.5 + (Math.random() - 0.5) * w * 0.15, y: goalLineY + PX_PER_YARD * 3.5 + Math.random() * 38 },
      { x: w * 0.68 + Math.random() * w * 0.18, y: goalLineY + PX_PER_YARD * 3 + Math.random() * 40 },
      { x: w * 0.85 + Math.random() * w * 0.12, y: goalLineY + PX_PER_YARD * 2.5 + Math.random() * 35 },
      { x: w * 0.5 + (Math.random() - 0.5) * w * 0.2, y: goalLineY + PX_PER_YARD * 1.5 + Math.random() * 25 },
    ];
    // Routes from each of 4 defenders to their X (arrows meet the X's like blocking)
    const routes = positions.slice(0, 4).map((pos, i) => {
      const p0 = { x: pos.x, y: pos.y };
      const p3 = { x: xCoords[i].x, y: xCoords[i].y };
      const p1 = { x: p0.x + (p3.x - p0.x) * 0.33, y: p0.y + (p3.y - p0.y) * 0.33 };
      const p2 = { x: p0.x + (p3.x - p0.x) * 0.67, y: p0.y + (p3.y - p0.y) * 0.67 };
      return { p0, p1, p2, p3 };
    });
    const routeColors = routes.map((_, i) => NEON[i % NEON.length]);
    return { cardPositions, routes, routeColors, xCoords };
  }, [w, line10Y, goalLineY]);

  useEffect(() => {
    cycleStartRef.current = performance.now();
    if (mode === 'offense') playRef.current = initOffensePlay();
    else playRef.current = initDefensePlay();
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

    const frame = (now) => {
      const play = playRef.current;
      const dt = now - cycleStartRef.current;

      // Transparent – only chalk arrows and X's; background shows through
      ctx.clearRect(0, 0, w, h);

      play.xCoords.forEach((xc, i) => drawChalkX(ctx, xc.x, xc.y, NEON[i % NEON.length]));

      if (mode === 'offense' && play.routes && play.routes.length) {
        const drawT = Math.min(1, (dt - CYCLE_PAUSE_MS) / ARROW_TRAVEL_MS);
        const eased = drawT < 0 ? 0 : drawT < 0.5 ? 4 * drawT * drawT * drawT : 1 - Math.pow(-2 * drawT + 2, 3) / 2;
        play.routes.forEach((r, i) => {
          const color = play.routeColors[i] || NEON[i % NEON.length];
          const segments = 80;
          const endI = Math.ceil(eased * segments);
          const pts = [];
          for (let j = 0; j <= endI; j++) {
            const t = j / segments;
            pts.push(bezierPoint(r.p0, r.p1, r.p2, r.p3, t));
          }
          if (pts.length >= 2) {
            drawChalkLine(ctx, pts, color, false);
            // Arrowhead always on the moving tip throughout the animation
            const tip = pts[pts.length - 1];
            const prev = pts[pts.length - 2];
            drawChalkArrowhead(ctx, tip, Math.atan2(tip.y - prev.y, tip.x - prev.x), color);
          }
        });

        if (dt > CYCLE_PAUSE_MS + ARROW_TRAVEL_MS + 600) {
          cycleStartRef.current = now;
          playRef.current = initOffensePlay();
        }
      } else if (mode === 'defense' && play.routes && play.routes.length) {
        const drawT = Math.min(1, (dt - CYCLE_PAUSE_MS) / ARROW_TRAVEL_MS);
        const eased = drawT < 0 ? 0 : drawT < 0.5 ? 4 * drawT * drawT * drawT : 1 - Math.pow(-2 * drawT + 2, 3) / 2;
        play.routes.forEach((r, i) => {
          const color = play.routeColors[i] || NEON[i % NEON.length];
          const segments = 80;
          const endI = Math.ceil(eased * segments);
          const pts = [];
          for (let j = 0; j <= endI; j++) {
            const t = j / segments;
            pts.push(bezierPoint(r.p0, r.p1, r.p2, r.p3, t));
          }
          if (pts.length >= 2) {
            drawChalkLine(ctx, pts, color, true);
            // Flat head always on the moving line throughout the animation
            const tip = pts[pts.length - 1];
            const prev = pts[pts.length - 2];
            drawChalkFlatHead(ctx, tip, Math.atan2(tip.y - prev.y, tip.x - prev.x), color);
          }
        });

        if (dt > CYCLE_PAUSE_MS + ARROW_TRAVEL_MS + 600) {
          cycleStartRef.current = now;
          playRef.current = initDefensePlay();
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [w, h, mode, initOffensePlay, initDefensePlay, endzoneH, goalLineY, line10Y]);

  const cards = roster?.cards || {};
  const play = playRef.current;

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none"
        style={{
          position: 'fixed',
          inset: 0,
          width: w,
          height: h,
          zIndex: 0,
          background: 'transparent',
        }}
      />
      {/* Cards on background – clickable to change roster */}
      <div
        style={{ position: 'fixed', inset: 0, width: w, height: h, zIndex: 0 }}
      >
        {cardLayout.map((pos) => {
          const slot = {
            id: pos.slotId,
            label: pos.label,
            position: SLOT_TO_POSITION[pos.slotId] || pos.label,
          };
          const card = cards[pos.slotId] || null;
          return (
            <div
              key={pos.slotId}
              className="absolute flex justify-center items-center cursor-pointer active:scale-95 transition-transform"
              style={{
                left: pos.x - CARD_W / 2,
                top: pos.y - CARD_H / 2,
                width: CARD_W,
                height: CARD_H,
                pointerEvents: 'auto',
              }}
              onClick={() => onSlotClick?.(slot)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSlotClick?.(slot); } }}
              aria-label={`${pos.label} slot, tap to change card`}
            >
              <MiniCard
                card={card}
                position={pos.label}
                empty={!card}
                fieldSize
              />
            </div>
          );
        })}
        
        {/* Tier Info Display - Bottom left of field, above the offense/defense bar */}
        {tierInfo && (
          <div 
            className="absolute flex flex-col gap-0.5"
            style={{ 
              left: '8px', 
              bottom: 'max(200px, 28vh)',
              zIndex: 10,
            }}
          >
            <div 
              className="px-1 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
              style={{ 
                backgroundColor: 'rgba(0,229,255,0.15)',
                border: '1px solid rgba(0,229,255,0.3)',
                fontFamily: "'Rajdhani', sans-serif",
              }}
            >
              <span className="text-cyan-400/70">{tierInfo.sideLabel} Cap = </span>
              <span className="text-cyan-400">{tierInfo.cap}</span>
            </div>
            <div 
              className="px-1 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
              style={{ 
                backgroundColor: 'rgba(0,229,255,0.15)',
                border: `1px solid ${tierInfo.isOverCap ? 'rgba(239,68,68,0.5)' : 'rgba(0,229,255,0.3)'}`,
                fontFamily: "'Rajdhani', sans-serif",
              }}
            >
              <span className="text-cyan-400/70">{tierInfo.sideLabel} Sum = </span>
              <span style={{ color: tierInfo.isOverCap ? '#ef4444' : '#00e5ff' }}>{tierInfo.sum}</span>
              <span className="text-cyan-400/50">/{tierInfo.cap}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
