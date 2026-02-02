import React, { useEffect, useMemo, useRef } from "react";

const COLORS = {
  field: "#06080A",
  icy: "#8FD9FF",
  icyBright: "#C7EEFF",
  neon: ["#4CCBFF", "#4AA3FF", "#6CFF3E", "#FF4FA3", "#FF9A2E"],
};

const pxPerYard = 18; // tune for density
const fieldCycleYards = 100; // endzone to endzone
const loopMs = 45_000; // 45 second scroll loop (50% slower than 30s)
const yardsPerTick = 5;
const BG_DIM = 0.62; // overall background dim (lower = dimmer)
const SCROLL_DIR = -1; // -1 = scroll bottom->up (content moves up)
const ENDZONE_HEIGHT_PX = 72; // fixed endzone band at top/bottom of viewport

function mod(n, m) {
  return ((n % m) + m) % m;
}

function yardLabel(yardInCycle) {
  // yardInCycle in [0,100)
  // Only show numbers on the 10s, not on 0.
  if (yardInCycle === 0) return null;
  if (yardInCycle % 10 !== 0) return null; // skip 5-yard lines = your “skip a line”
  if (yardInCycle <= 50) return yardInCycle;
  return 100 - yardInCycle; // 60..90 -> 40..10
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Smoother easing for arrow travel (ease in and out)
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function bezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

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

function norm(v) {
  const d = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / d, y: v.y / d };
}

// Build a simple “curve around X” cubic bezier
function buildBezier(p0, p3, avoid) {
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const dir = { x: dx / len, y: dy / len };
  const perp = { x: -dir.y, y: dir.x };

  const m = { x: (p0.x + p3.x) / 2, y: (p0.y + p3.y) / 2 };
  const side = Math.sign((m.x - avoid.x) * perp.x + (m.y - avoid.y) * perp.y) || 1;

  const bend = Math.min(140, Math.max(60, Math.hypot(m.x - avoid.x, m.y - avoid.y)));

  const p1 = { x: p0.x + dx * 0.33 + perp.x * side * bend, y: p0.y + dy * 0.33 + perp.y * side * bend };
  const p2 = { x: p0.x + dx * 0.66 + perp.x * side * bend, y: p0.y + dy * 0.66 + perp.y * side * bend };
  return { p0, p1, p2, p3 };
}

// Buttonhook: upfield then curl back to the receiver
function buildButtonhook(p0, p3) {
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const dist = Math.hypot(dx, dy) || 1;
  const up = { x: -dx / dist, y: -dy / dist };
  const perp = { x: -up.y, y: up.x };
  const side = Math.random() > 0.5 ? 1 : -1;
  const overshoot = dist * 0.5;
  const p1 = { x: p0.x + dx * 0.25 + perp.x * side * 50, y: p0.y + dy * 0.25 + perp.y * side * 50 };
  const p2 = { x: p3.x + up.x * overshoot + perp.x * side * 80, y: p3.y + up.y * overshoot + perp.y * side * 80 };
  return { p0, p1, p2, p3 };
}

// Slant: diagonal, nearly straight
function buildSlant(p0, p3) {
  const p1 = { x: p0.x + (p3.x - p0.x) * 0.35, y: p0.y + (p3.y - p0.y) * 0.35 };
  const p2 = { x: p0.x + (p3.x - p0.x) * 0.7, y: p0.y + (p3.y - p0.y) * 0.7 };
  return { p0, p1, p2, p3 };
}

// Post: upfield then break inward (toward center)
function buildPost(p0, p3, centerX) {
  const midY = p0.y + (p3.y - p0.y) * 0.5;
  const towardCenter = centerX - p0.x;
  const p1 = { x: p0.x + (p3.x - p0.x) * 0.3 + towardCenter * 0.15, y: p0.y + (p3.y - p0.y) * 0.35 };
  const p2 = { x: p0.x + (p3.x - p0.x) * 0.7 + towardCenter * 0.35, y: p0.y + (p3.y - p0.y) * 0.75 };
  return { p0, p1, p2, p3 };
}

// Flag: upfield then break outward (toward sideline)
function buildFlag(p0, p3, centerX) {
  const awayFromCenter = p0.x >= centerX ? 1 : -1;
  const k = 50 * awayFromCenter;
  const p1 = { x: p0.x + (p3.x - p0.x) * 0.3 + k * 0.3, y: p0.y + (p3.y - p0.y) * 0.35 };
  const p2 = { x: p0.x + (p3.x - p0.x) * 0.7 + k * 0.8, y: p0.y + (p3.y - p0.y) * 0.75 };
  return { p0, p1, p2, p3 };
}

// --- 5 arrow route types (per-play shuffled order); exactly 5 arrows per play ---
// 1 & 2. Straight up
function buildStraight(p0, p3) {
  const p1 = { x: p0.x + (p3.x - p0.x) * 0.35, y: p0.y + (p3.y - p0.y) * 0.35 };
  const p2 = { x: p0.x + (p3.x - p0.x) * 0.7, y: p0.y + (p3.y - p0.y) * 0.7 };
  return { p0, p1, p2, p3 };
}
// 3. Sharp 45° turn at 50% (literal angle: p1 = p2 = corner)
function buildTurn45(p0, p3) {
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const dist = Math.hypot(dx, dy) || 1;
  const up = { x: dx / dist, y: dy / dist };
  const perp = { x: -up.y, y: up.x };
  const side = Math.random() > 0.5 ? 1 : -1;
  const corner = { x: p0.x + dx * 0.5, y: p0.y + dy * 0.5 };
  const leg = dist * 0.5;
  const end = { x: corner.x + (up.x * 0.707 + perp.x * side * 0.707) * leg, y: corner.y + (up.y * 0.707 + perp.y * side * 0.707) * leg };
  return { p0, p1: corner, p2: corner, p3: end };
}
// 4. Sharp 90° turn at 50% (literal angle)
function buildTurn90(p0, p3) {
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const dist = Math.hypot(dx, dy) || 1;
  const perp = { x: -dy / dist, y: dx / dist };
  const side = Math.random() > 0.5 ? 1 : -1;
  const corner = { x: p0.x + dx * 0.5, y: p0.y + dy * 0.5 };
  const end = { x: corner.x + perp.x * side * dist * 0.5, y: corner.y + perp.y * side * dist * 0.5 };
  return { p0, p1: corner, p2: corner, p3: end };
}
// 5. Out 75%, sharp 135° turn, come back toward center of yard line (either side)
function buildOut135(p0, _p3, centerX) {
  const totalUp = 260;
  const corner = { x: p0.x, y: p0.y - totalUp * 0.75 };
  const towardCenter = centerX > p0.x ? 1 : -1;
  const comeBack = 0.35 * totalUp;
  const p3 = {
    x: corner.x + towardCenter * 0.707 * comeBack,
    y: corner.y + 0.707 * comeBack,
  };
  return { p0, p1: corner, p2: corner, p3 };
}

function shuffleArray(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ARROWS_PER_PLAY = 5; // exactly 5: straight, straight, sharp 45°, sharp 90°, out 75% + 135° back to center
const ARROW_ROUTE_BUILDERS = [buildStraight, buildStraight, buildTurn45, buildTurn90, buildOut135];
const SPAWN_INTERVAL_MS = 4000; // new play every 4 seconds
const ARROW_TRAVEL_MS = 4000;   // arrows take 4s to travel and disappear

// Plays on every 10-yard line
const BAND_YARDS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

export default function PlayfieldBackground() {
  const canvasRef = useRef(null);
  const playsRef = useRef([]);
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const nextBandRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const endzonePulseRef = useRef(null);
  const pulseWhenLast10FinishesRef = useRef(false);

  const fieldHeightPx = fieldCycleYards * pxPerYard;

  // precompute 5-yard ticks for drawing lines
  const ticks = useMemo(() => {
    const a = [];
    for (let y = 0; y <= fieldCycleYards; y += yardsPerTick) a.push(y);
    return a;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    startTimeRef.current = performance.now();

    const maybeSpawn = (now, w, h) => {
      const plays = playsRef.current;

      if (plays.length > 0) return;

      const elapsed = now - lastSpawnTimeRef.current;
      if (lastSpawnTimeRef.current !== 0 && elapsed < SPAWN_INTERVAL_MS) return;

      lastSpawnTimeRef.current = now;
      const t0 = now;
      const margin = 0.18;
      const step = (1 - 2 * margin) / Math.max(1, ARROWS_PER_PLAY - 1);

      // Spawn all 5 yard lines at once; each play gets a shuffled order of the 5 route types
      for (let band = 0; band < BAND_YARDS.length; band++) {
        const lineYard = BAND_YARDS[band];
        const lineY = lineYard * pxPerYard;
        if (band === BAND_YARDS.length - 1) pulseWhenLast10FinishesRef.current = true;

        const routeOrder = shuffleArray([0, 1, 2, 3, 4]);
        const centerX = w / 2;

        for (let i = 0; i < ARROWS_PER_PLAY; i++) {
          const startO = {
            x: w * (margin + i * step) + rand(-16, 16),
            y: lineY,
          };
          const upfieldY = lineY - rand(220, 320);
          const endO = { x: startO.x + rand(-60, 60), y: upfieldY };

          const buildRoute = ARROW_ROUTE_BUILDERS[routeOrder[i]];
          const b = buildRoute(startO, endO, centerX);
          const avoidX = { x: (b.p0.x + b.p3.x) / 2 + rand(-25, 25), y: lineY - rand(80, 120) };

          const color = pick(COLORS.neon);

          plays.push({
            id: `${t0}-${band}-${i}-${Math.random()}`,
            color,
            p0: b.p0,
            p1: b.p1,
            p2: b.p2,
            p3: b.p3,
            avoidX,
            startO: b.p0,
            endO: b.p3,
            t0,
            oIn: 120,
            drawDur: ARROW_TRAVEL_MS,
            hold: 0,
            fadeOut: 280,
          });
        }
      }
    };

    const drawArrowhead = (P, T, color, width) => {
      const t = norm(T);
      const a = Math.atan2(t.y, t.x);
      const size = 10;
      const left = { x: P.x - size * Math.cos(a - 0.45), y: P.y - size * Math.sin(a - 0.45) };
      const right = { x: P.x - size * Math.cos(a + 0.45), y: P.y - size * Math.sin(a + 0.45) };

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(P.x, P.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
      ctx.restore();
    };

    const drawPlay = (play, now, scrollPx) => {
      // local time
      const dt = now - play.t0;

      // phases
      const tO = Math.min(1, Math.max(0, dt / play.oIn));
      const drawT = (dt - play.oIn) / play.drawDur;
      const u = Math.min(1, Math.max(0, drawT));
      const eased = easeInOutCubic(u);

      // fade out after hold
      const endTime = play.oIn + play.drawDur + play.hold;
      const fadeT = (dt - endTime) / play.fadeOut;
      const fade = fadeT <= 0 ? 1 : Math.max(0, 1 - fadeT);

      const alpha = fade * BG_DIM;

      // convert field-space y to screen-space y (scrolling up)
      const toScreen = (p) => ({ x: p.x, y: p.y - scrollPx });

      const p0 = toScreen(play.p0);
      const p1 = toScreen(play.p1);
      const p2 = toScreen(play.p2);
      const p3 = toScreen(play.p3);

      // O appears (start)
      ctx.save();
      ctx.globalAlpha = 0.95 * tO * alpha;
      ctx.strokeStyle = play.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = play.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(toScreen(play.startO).x, toScreen(play.startO).y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // End O fades in near completion
      const endOAlpha = Math.min(1, Math.max(0, (eased - 0.72) / 0.28));
      ctx.save();
      ctx.globalAlpha = 0.75 * endOAlpha * alpha;
      ctx.strokeStyle = play.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = play.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(toScreen(play.endO).x, toScreen(play.endO).y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Defender X (static)
      const x = toScreen(play.avoidX);
      ctx.save();
      ctx.globalAlpha = 0.65 * alpha;
      ctx.strokeStyle = play.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = play.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x.x - 10, x.y - 10);
      ctx.lineTo(x.x + 10, x.y + 10);
      ctx.moveTo(x.x + 10, x.y - 10);
      ctx.lineTo(x.x - 10, x.y + 10);
      ctx.stroke();
      ctx.restore();

      // Arrow draw (smooth progressive reveal: more segments + smooth head position)
      const segments = 160;
      const headT = eased;
      const segEnd = Math.min(segments, Math.ceil(headT * segments));

      ctx.save();
      ctx.strokeStyle = play.color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      for (let i = 0; i <= segEnd; i++) {
        const t = i / segments;
        const P = bezierPoint(p0, p1, p2, p3, t);
        if (i === 0) ctx.moveTo(P.x, P.y);
        else ctx.lineTo(P.x, P.y);
      }

      // Soft glow pass
      ctx.globalAlpha = 0.35 * alpha;
      ctx.shadowColor = play.color;
      ctx.shadowBlur = 24;
      ctx.lineWidth = 5;
      ctx.stroke();

      // Main stroke
      ctx.globalAlpha = 0.92 * alpha;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Arrowhead at smooth position (not snapped to segment)
      const P = bezierPoint(p0, p1, p2, p3, headT);
      const T = bezierTangent(p0, p1, p2, p3, headT);
      ctx.shadowBlur = 22;
      drawArrowhead(P, T, play.color, 2.5);

      ctx.restore();
    };

    const drawField = (w, h, scrollPx, now) => {
      // background
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = COLORS.field;
      ctx.fillRect(0, 0, w, h);

      const measureTextWidth = (text, font) => {
        ctx.save();
        ctx.font = font;
        const w = ctx.measureText(String(text)).width;
        ctx.restore();
        return w;
      };

      // draw TWO cycles stacked to avoid any seam
      for (const cycleOffset of [0, fieldHeightPx]) {
        const isPrimaryCycle = cycleOffset === 0;
        const baseScroll = mod(scrollPx, fieldHeightPx) - cycleOffset;

        // yard lines + hashes + numbers
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = COLORS.icy;
        ctx.shadowColor = COLORS.icy;
        ctx.shadowBlur = 6;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = 0.55 * BG_DIM;

        for (const yard of ticks) {
          const yPx = yard * pxPerYard - baseScroll;

          const yardInCycle = yard;
          const label =
            yardInCycle === 0 || yardInCycle === 100
              ? "FIRST & 10"
              : yardLabel(yardInCycle);

          const xStart = 20;
          const xEnd = w - 20;
          const segments = [];
          let cutouts = [];

          if (label != null && label !== "") {
            const labelStr = String(label);
            const font = label === "FIRST & 10" ? "64px CollegeBlock, system-ui, sans-serif" : "48px CollegeBlock, system-ui, sans-serif";
            const labelW = measureTextWidth(labelStr, font) || (label === "FIRST & 10" ? 320 : 60);
            const pad = 16;
            const leftCx = 40;
            const rightCx = w - 40;
            cutouts.push([leftCx - labelW / 2 - pad, leftCx + labelW / 2 + pad]);
            cutouts.push([rightCx - labelW / 2 - pad, rightCx + labelW / 2 + pad]);
          }

          // Normalize cutouts into drawable segments
          cutouts = cutouts
            .map(([a, b]) => [Math.max(xStart, a), Math.min(xEnd, b)])
            .filter(([a, b]) => b > a)
            .sort((a, b) => a[0] - b[0]);

          let cursor = xStart;
          for (const [a, b] of cutouts) {
            if (a > cursor) segments.push([cursor, a]);
            cursor = Math.max(cursor, b);
          }
          if (cursor < xEnd) segments.push([cursor, xEnd]);

          for (const [sx, ex] of segments) {
            if (ex - sx < 6) continue;
            ctx.beginPath();
            ctx.moveTo(sx, yPx);
            ctx.lineTo(ex, yPx);
            ctx.stroke();
          }

          // side hashes (8 per pillar; top 4 removed)
          for (let i = 4; i < 12; i++) {
            const yy = yPx + i * 6;
            ctx.beginPath();
            ctx.moveTo(10, yy);
            ctx.lineTo(16, yy);
            ctx.moveTo(w - 16, yy);
            ctx.lineTo(w - 10, yy);
            ctx.stroke();
          }

          if (label != null && label !== "") {
            ctx.save();
            ctx.fillStyle = COLORS.icyBright;
            ctx.shadowColor = COLORS.icy;
            ctx.shadowBlur = 12;
            ctx.font = label === "FIRST & 10" ? "64px CollegeBlock, system-ui, sans-serif" : "48px CollegeBlock, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            if (label === "FIRST & 10") {
              // Endzone text stays horizontal (no rotation)
              ctx.fillText(String(label), 40, yPx);
              ctx.fillText(String(label), w - 40, yPx);
            } else {
              // Yard numbers: rotate so they face into the field
              ctx.save();
              ctx.translate(40, yPx);
              ctx.rotate(-Math.PI / 2);
              ctx.fillText(String(label), 0, 0);
              ctx.restore();
              ctx.save();
              ctx.translate(w - 40, yPx);
              ctx.rotate(Math.PI / 2);
              ctx.fillText(String(label), 0, 0);
              ctx.restore();
            }

            if (yardInCycle === 50 && isPrimaryCycle) {
              ctx.font = "92px CollegeBlock, system-ui, sans-serif";
              ctx.shadowBlur = 16;
              ctx.fillText("F10", w / 2, yPx);
            }
            ctx.restore();
          }
        }

        ctx.restore();
      }

      // Fixed endzone outline and "FIRST & 10" at top and bottom; pulse when play crosses into endzone
      const pulseAt = endzonePulseRef.current;
      const pulseDur = 600;
      const isPulsing = pulseAt != null && now - pulseAt < pulseDur;
      ctx.save();
      ctx.strokeStyle = COLORS.icy;
      ctx.shadowColor = COLORS.icy;
      ctx.shadowBlur = isPulsing ? 24 : 8;
      ctx.lineWidth = isPulsing ? 5 : 3;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (isPulsing ? 0.9 : 0.6) * BG_DIM;
      ctx.strokeRect(0, 0, w, ENDZONE_HEIGHT_PX);
      ctx.strokeRect(0, h - ENDZONE_HEIGHT_PX, w, ENDZONE_HEIGHT_PX);
      ctx.restore();

      // subtle grain overlay (cheap + nice)
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.06;
      const grainStep = 3;
      for (let y = 0; y < h; y += grainStep) {
        for (let x = 0; x < w; x += grainStep) {
          const v = Math.random() * 255;
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.restore();

      // dim overlay + vignette to keep UI legible
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      ctx.save();
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.85);
      g.addColorStop(0, "rgba(0,0,0,0.12)");
      g.addColorStop(1, "rgba(0,0,0,0.58)");
      ctx.fillStyle = g;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    };

    const frame = (now) => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      const t = (now - startTimeRef.current) % loopMs;
      const scrollPhase = ((10 * pxPerYard - h / 2) % fieldHeightPx + fieldHeightPx) % fieldHeightPx;
      const scrollPx = scrollPhase + SCROLL_DIR * (t / loopMs) * fieldHeightPx;

      drawField(w, h, scrollPx, now);

      maybeSpawn(now, w, h);

      const hadPlays = playsRef.current.length > 0;
      playsRef.current = playsRef.current.filter((p) => {
        const life = p.oIn + p.drawDur + p.hold + p.fadeOut;
        return now - p.t0 < life;
      });
      if (hadPlays && playsRef.current.length === 0 && pulseWhenLast10FinishesRef.current) {
        endzonePulseRef.current = now;
        pulseWhenLast10FinishesRef.current = false;
      }

      // draw plays twice (stacked) so they remain continuous across seam
      for (const seamOffset of [0, fieldHeightPx]) {
        const plays = playsRef.current;
        for (const p of plays) {
          // draw shifted copy
          const shifted = {
            ...p,
            p0: { x: p.p0.x, y: p.p0.y + seamOffset },
            p1: { x: p.p1.x, y: p.p1.y + seamOffset },
            p2: { x: p.p2.x, y: p.p2.y + seamOffset },
            p3: { x: p.p3.x, y: p.p3.y + seamOffset },
            avoidX: { x: p.avoidX.x, y: p.avoidX.y + seamOffset },
            startO: { x: p.startO.x, y: p.startO.y + seamOffset },
            endO: { x: p.endO.x, y: p.endO.y + seamOffset },
          };
          drawPlay(shifted, now, scrollPx);
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [fieldHeightPx, ticks]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        width: "100vw",
        height: "100vh",
        background: COLORS.field,
      }}
    />
  );
}

