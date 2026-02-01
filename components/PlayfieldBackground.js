import React, { useEffect, useMemo, useRef } from "react";

const COLORS = {
  field: "#06080A",
  icy: "#8FD9FF",
  icyBright: "#C7EEFF",
  neon: ["#4CCBFF", "#4AA3FF", "#6CFF3E", "#FF4FA3", "#FF9A2E"],
};

const pxPerYard = 18; // tune for density
const fieldCycleYards = 100; // endzone to endzone
const loopMs = 20_000; // 20 second scroll loop (slower)
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
  const glyphsRef = useRef({ ready: false, map: new Map() });

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

    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const sampleBg = (imgData) => {
      // average the 4 corners
      const { data, width, height } = imgData;
      const pts = [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1],
      ];
      let r = 0, g = 0, b = 0;
      for (const [x, y] of pts) {
        const i = (y * width + x) * 4;
        r += data[i + 0];
        g += data[i + 1];
        b += data[i + 2];
      }
      return { r: r / pts.length, g: g / pts.length, b: b / pts.length };
    };

    const chromaKeyToAlpha = (c, threshold = 52) => {
      const cctx = c.getContext("2d");
      if (!cctx) return c;
      const imgData = cctx.getImageData(0, 0, c.width, c.height);
      const bg = sampleBg(imgData);
      const { data } = imgData;

      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i + 0] - bg.r;
        const dg = data[i + 1] - bg.g;
        const db = data[i + 2] - bg.b;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist < threshold) {
          data[i + 3] = 0; // transparent
        }
      }

      cctx.putImageData(imgData, 0, 0);
      return c;
    };

    const trimCanvas = (c) => {
      const cctx = c.getContext("2d");
      if (!cctx) return c;
      const img = cctx.getImageData(0, 0, c.width, c.height);
      const { data, width, height } = img;

      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const a = data[(y * width + x) * 4 + 3];
          if (a > 8) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX < minX || maxY < minY) return c; // empty

      const pad = 3;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(width - 1, maxX + pad);
      maxY = Math.min(height - 1, maxY + pad);

      const tw = maxX - minX + 1;
      const th = maxY - minY + 1;
      const out = document.createElement("canvas");
      out.width = tw;
      out.height = th;
      const outCtx = out.getContext("2d");
      if (!outCtx) return c;
      outCtx.drawImage(c, minX, minY, tw, th, 0, 0, tw, th);
      return out;
    };

    const sliceRow = (img, y0, y1, x0, x1, count) => {
      const out = [];
      const rowH = Math.max(1, Math.floor(y1 - y0));
      const rowW = Math.max(1, Math.floor(x1 - x0));
      const cellW = rowW / count;
      for (let i = 0; i < count; i++) {
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.floor(cellW));
        c.height = rowH;
        const cctx = c.getContext("2d");
        if (!cctx) continue;
        const sx = x0 + i * cellW;
        cctx.drawImage(img, sx, y0, cellW, rowH, 0, 0, c.width, c.height);
        out.push(trimCanvas(chromaKeyToAlpha(c)));
      }
      return out;
    };

    const warmGlyphCache = async () => {
      // These two images come from your provided glyph sheets.
      // If they fail to load, we fall back to normal canvas text.
      try {
        const [sheetImg, zeroImg] = await Promise.all([
          loadImage("/fonts/f10-glyph-sheet.png"),
          loadImage("/fonts/f10-glyph-0.png"),
        ]);

        const map = new Map();

        // Digits 1-9 live on the bottom row of the sheet.
        // These bounds are tuned for the provided 1024x682 sheet.
        const y0 = sheetImg.height * 0.735;
        const y1 = sheetImg.height * 0.93;
        const x0 = sheetImg.width * 0.20;
        const x1 = sheetImg.width * 0.86;
        const digits = sliceRow(sheetImg, y0, y1, x0, x1, 9);
        for (let i = 0; i < digits.length; i++) {
          map.set(String(i + 1), digits[i]);
        }

        // 0 image is full-frame on dark background; key it and trim.
        {
          const c = document.createElement("canvas");
          c.width = zeroImg.width;
          c.height = zeroImg.height;
          const cctx = c.getContext("2d");
          if (cctx) {
            cctx.drawImage(zeroImg, 0, 0);
            const zero = trimCanvas(chromaKeyToAlpha(c, 40));
            map.set("0", zero);
          }
        }

        glyphsRef.current = { ready: map.size >= 10, map };
      } catch (e) {
        // ignore; use fallback fillText
        glyphsRef.current = { ready: false, map: new Map() };
      }
    };

    const drawGlyphText = (text, x, y, heightPx, align = "center") => {
      const { ready, map } = glyphsRef.current;
      if (!ready) return false;

      const chars = String(text).split("");
      const gap = Math.max(2, Math.round(heightPx * 0.08));
      const glyphs = chars
        .map((ch) => map.get(ch) || null)
        .filter(Boolean);

      if (glyphs.length !== chars.length) return false;

      const widths = glyphs.map((g) => (g.width / Math.max(1, g.height)) * heightPx);
      const totalW = widths.reduce((s, w) => s + w, 0) + gap * (glyphs.length - 1);

      let startX = x;
      if (align === "center") startX = x - totalW / 2;
      if (align === "right") startX = x - totalW;

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = "lighter";
      let cx = startX;
      for (let i = 0; i < glyphs.length; i++) {
        const g = glyphs[i];
        const w = widths[i];
        ctx.drawImage(g, cx, y - heightPx / 2, w, heightPx);
        cx += w + gap;
      }
      ctx.restore();

      return true;
    };

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
    warmGlyphCache();

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

      const b = buildBezier(startO, endO, avoidX);
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

      const measureGlyphWidth = (text, heightPx) => {
        const { ready, map } = glyphsRef.current;
        const chars = String(text).split("");
        const gap = Math.max(2, Math.round(heightPx * 0.08));
        if (ready) {
          const glyphs = chars.map((ch) => map.get(ch) || null);
          if (glyphs.some((g) => !g)) return null;
          const widths = glyphs.map((g) => (g.width / Math.max(1, g.height)) * heightPx);
          return widths.reduce((s, ww) => s + ww, 0) + gap * (glyphs.length - 1);
        }
        // reasonable fallback if glyphs not ready
        const approxChar = heightPx * 0.62;
        return chars.length * approxChar + gap * (chars.length - 1);
      };

      // draw TWO cycles stacked to avoid any seam
      for (const cycleOffset of [0, fieldHeightPx]) {
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
            const textH = 48;
            const labelW = measureGlyphWidth(labelStr, textH) || 60;
            const pad = 16;
            const leftCx = 45;
            const rightCx = w - 45;
            cutouts.push([leftCx - labelW / 2 - pad, leftCx + labelW / 2 + pad]);
            cutouts.push([rightCx - labelW / 2 - pad, rightCx + labelW / 2 + pad]);
          }

          // endzone center text cutout (only one endzone)
          const isEndzone = yardInCycle === 5;
          if (isEndzone) {
            ctx.save();
            ctx.font = `64px F10Varsity, system-ui, sans-serif`;
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

          // side hashes (simple)
          for (let i = 0; i < 12; i++) {
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
            ctx.font = `48px F10Varsity, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const okL = drawGlyphText(String(label), 45, yPx, 48, "center");
            const okR = drawGlyphText(String(label), w - 45, yPx, 48, "center");
            if (!okL) ctx.fillText(String(label), 45, yPx);
            if (!okR) ctx.fillText(String(label), w - 45, yPx);

            if (yardInCycle === 50) {
              ctx.font = `92px F10Varsity, system-ui, sans-serif`;
              ctx.shadowBlur = 16;
              ctx.fillText("F10", w / 2, yPx + 70);
            }
            ctx.restore();
          }

          // Endzone text at 5 and 95
          if (yardInCycle === 5) {
            ctx.save();
            ctx.fillStyle = COLORS.icyBright;
            ctx.shadowColor = COLORS.icy;
            ctx.shadowBlur = 16;
            ctx.font = `64px F10Varsity, system-ui, sans-serif`;
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

