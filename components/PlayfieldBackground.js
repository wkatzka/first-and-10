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
const SCROLL_DIR = 1; // 1 = bottom->up, -1 = top->down

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

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function PlayfieldBackground() {
  const canvasRef = useRef(null);
  const playsRef = useRef([]);
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);

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

    // Spawn plays continuously
    const maybeSpawn = (now, w) => {
      const plays = playsRef.current;

      // keep ~10 active plays
      if (plays.length > 10) return;

      // random spawn cadence
      if (Math.random() > 0.12) return;

      // spawn in field space across one full cycle so it feels distributed
      const startO = { x: rand(w * 0.18, w * 0.82), y: rand(fieldHeightPx * 0.15, fieldHeightPx * 0.95) };
      const endO = { x: rand(w * 0.18, w * 0.82), y: startO.y - rand(160, 420) };

      const avoidX = {
        x: lerp(startO.x, endO.x, 0.5) + rand(-60, 60),
        y: lerp(startO.y, endO.y, 0.5) + rand(-60, 60),
      };

      const routeType = pick([buildBezier, buildButtonhook, buildSlant]);
      const b = routeType === buildBezier ? buildBezier(startO, endO, avoidX) : routeType(startO, endO);
      const color = pick(COLORS.neon);

      plays.push({
        id: `${now}-${Math.random()}`,
        color,
        p0: b.p0,
        p1: b.p1,
        p2: b.p2,
        p3: b.p3,
        avoidX,
        startO,
        endO,
        t0: now,
        oIn: 140,
        drawDur: rand(900, 1400),
        hold: 260,
        fadeOut: 240,
      });
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
      const eased = easeOutCubic(u);

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

      // Arrow draw (progressive)
      const segments = 70;
      const segEnd = Math.max(1, Math.floor(eased * segments));

      ctx.save();
      ctx.globalAlpha = 0.9 * alpha;
      ctx.strokeStyle = play.color;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = play.color;
      ctx.shadowBlur = 10;

      ctx.beginPath();
      for (let i = 0; i <= segEnd; i++) {
        const t = i / segments;
        const P = bezierPoint(p0, p1, p2, p3, t);
        if (i === 0) ctx.moveTo(P.x, P.y);
        else ctx.lineTo(P.x, P.y);
      }
      ctx.stroke();

      // Arrowhead at current end
      const tHead = segEnd / segments;
      const P = bezierPoint(p0, p1, p2, p3, tHead);
      const T = bezierTangent(p0, p1, p2, p3, tHead);
      drawArrowhead(P, T, play.color, 2);

      ctx.restore();
    };

    const drawField = (w, h, scrollPx) => {
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

          const yardInCycle = yard; // 0..100 in this local cycle
          const label = yardLabel(yardInCycle === 100 ? 0 : yardInCycle); // treat 100 as 0 seam

          // yard line (cut around labels so lines don't slice through numbers/text)
          const xStart = 20;
          const xEnd = w - 20;
          const segments = [];
          let cutouts = [];

          // sideline label cutouts
          if (label !== null) {
            const labelStr = String(label);
            const labelW = measureTextWidth(labelStr, "48px system-ui, sans-serif") || 60;
            const pad = 16;
            const leftCx = 40;
            const rightCx = w - 40;
            cutouts.push([leftCx - labelW / 2 - pad, leftCx + labelW / 2 + pad]);
            cutouts.push([rightCx - labelW / 2 - pad, rightCx + labelW / 2 + pad]);
          }

          // endzone center text cutout (only one endzone)
          const isEndzone = isPrimaryCycle && yardInCycle === 5;
          if (isEndzone) {
            ctx.save();
            ctx.font = "64px system-ui, sans-serif";
            const m = ctx.measureText("FIRST & 10");
            ctx.restore();
            const pad = 26;
            cutouts.push([w / 2 - m.width / 2 - pad, w / 2 + m.width / 2 + pad]);
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

          if (label !== null) {
            ctx.save();
            ctx.fillStyle = COLORS.icyBright;
            ctx.shadowColor = COLORS.icy;
            ctx.shadowBlur = 12;
            ctx.font = "48px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(label), 40, yPx);
            ctx.fillText(String(label), w - 40, yPx);

            if (yardInCycle === 50 && isPrimaryCycle) {
              ctx.font = "92px system-ui, sans-serif";
              ctx.shadowBlur = 16;
              ctx.fillText("F10", w / 2, yPx + 70);
            }
            ctx.restore();
          }

          // Endzone text at 5 and 95
          if (isPrimaryCycle && yardInCycle === 5) {
            ctx.save();
            ctx.fillStyle = COLORS.icyBright;
            ctx.shadowColor = COLORS.icy;
            ctx.shadowBlur = 16;
            ctx.font = "64px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("FIRST & 10", w / 2, yPx);
            ctx.restore();
          }
        }

        ctx.restore();
      }

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

      // Scroll: 0..fieldHeightPx over loopMs
      const t = (now - startTimeRef.current) % loopMs;
      const scrollPx = SCROLL_DIR * (t / loopMs) * fieldHeightPx;

      // Draw field
      drawField(w, h, scrollPx);

      // Spawn + draw plays (plays are in field space; draw uses same scrollPx)
      maybeSpawn(now, w);

      // cleanup dead plays
      playsRef.current = playsRef.current.filter((p) => {
        const life = p.oIn + p.drawDur + p.hold + p.fadeOut;
        return now - p.t0 < life;
      });

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

