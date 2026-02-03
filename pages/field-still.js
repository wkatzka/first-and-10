import { useEffect, useMemo, useRef, useState } from 'react';
import { Graduate } from 'next/font/google';
import Layout from '../components/Layout';

const graduate = Graduate({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
});

// Match PlayfieldBackground constants
const COLORS = {
  field: '#06080A',
  icy: '#8FD9FF',
  icyBright: '#C7EEFF',
};

const pxPerYard = 18;
const ENDZONE_DEPTH_YARDS = 10;
const fieldCycleYards = 100;
const fieldTotalYards = ENDZONE_DEPTH_YARDS + fieldCycleYards + ENDZONE_DEPTH_YARDS; // 120
const yardsPerTick = 5;
const BG_DIM = 0.62;

function mod(n, m) {
  return ((n % m) + m) % m;
}

function yardLabel(yardInCycle) {
  if (yardInCycle === ENDZONE_DEPTH_YARDS / 2) return 'FIRST & 10';
  if (yardInCycle === ENDZONE_DEPTH_YARDS + fieldCycleYards + ENDZONE_DEPTH_YARDS / 2) return 'FIRST & 10';
  if (yardInCycle < ENDZONE_DEPTH_YARDS || yardInCycle >= ENDZONE_DEPTH_YARDS + fieldCycleYards) return null;
  if (yardInCycle === ENDZONE_DEPTH_YARDS || yardInCycle === ENDZONE_DEPTH_YARDS + fieldCycleYards) return null;
  if (yardInCycle % yardsPerTick !== 0) return null;
  const fieldYard = yardInCycle - ENDZONE_DEPTH_YARDS;
  if (fieldYard % 10 !== 0) return null;
  if (fieldYard <= 50) return fieldYard;
  return 100 - fieldYard;
}

function drawOutlinedText(ctx, text, x, y, opts) {
  const {
    font,
    fillStyle,
    strokeStyle = 'rgba(0,0,0,0.72)',
    lineWidth = 12,
    shadowColor,
    shadowBlur = 16,
  } = opts || {};

  ctx.save();
  if (font) ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowBlur = 0;
  ctx.strokeStyle = strokeStyle;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = lineWidth;
  ctx.strokeText(String(text), x, y);

  if (shadowColor) ctx.shadowColor = shadowColor;
  ctx.shadowBlur = shadowBlur;
  if (fillStyle) ctx.fillStyle = fillStyle;
  ctx.fillText(String(text), x, y);
  ctx.restore();
}

export default function FieldStill({ user, onLogout, unreadMessages }) {
  const canvasRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  const ticks = useMemo(() => {
    const a = [];
    for (let y = 0; y <= fieldTotalYards; y += yardsPerTick) a.push(y);
    return a;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fixed export size (wide + full 120yd tall)
    const w = 1920;
    const h = fieldTotalYards * pxPerYard; // 2160
    canvas.width = w;
    canvas.height = h;

    // Background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.field;
    ctx.fillRect(0, 0, w, h);

    // Endzones (simple still: no animated dots)
    const endzoneH = ENDZONE_DEPTH_YARDS * pxPerYard;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4 * BG_DIM;
    ctx.strokeStyle = COLORS.icy;
    ctx.shadowColor = COLORS.icy;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, endzoneH);
    ctx.restore();

    // Yard lines + numbers
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = COLORS.icy;
    ctx.shadowColor = COLORS.icy;
    ctx.shadowBlur = 6;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.55 * BG_DIM;

    const xStart = 20;
    const xEnd = w - 20;

    const measureTextWidth = (text, font) => {
      ctx.save();
      ctx.font = font;
      const ww = ctx.measureText(String(text)).width;
      ctx.restore();
      return ww;
    };

    for (const yard of ticks) {
      const yPx = yard * pxPerYard;
      const label = yardLabel(yard);

      // Cutouts so lines don't cross text
      let cutouts = [];
      if (label != null && label !== '') {
        const font = label === 'FIRST & 10'
          ? '96px Graduate, CollegeBlock, system-ui, sans-serif'
          : '64px CollegeBlock, system-ui, sans-serif';
        const labelW = measureTextWidth(label, font) || (label === 'FIRST & 10' ? 600 : 80);
        const pad = 18;

        if (label === 'FIRST & 10') {
          const cx = w / 2;
          cutouts.push([cx - labelW / 2 - pad, cx + labelW / 2 + pad]);
        } else {
          const leftCx = 72;
          const rightCx = w - 72;
          cutouts.push([leftCx - labelW / 2 - pad, leftCx + labelW / 2 + pad]);
          cutouts.push([rightCx - labelW / 2 - pad, rightCx + labelW / 2 + pad]);
        }
      }

      cutouts = cutouts
        .map(([a, b]) => [Math.max(xStart, a), Math.min(xEnd, b)])
        .filter(([a, b]) => b > a)
        .sort((a, b) => a[0] - b[0]);

      const segments = [];
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

      // Side hashes
      for (let i = 4; i < 12; i++) {
        const yy = yPx + i * 6;
        ctx.beginPath();
        ctx.moveTo(10, yy);
        ctx.lineTo(16, yy);
        ctx.moveTo(w - 16, yy);
        ctx.lineTo(w - 10, yy);
        ctx.stroke();
      }

      // Labels
      if (label != null && label !== '') {
        ctx.save();
        ctx.fillStyle = COLORS.icyBright;
        ctx.shadowColor = COLORS.icy;
        ctx.shadowBlur = 14;

        if (label === 'FIRST & 10') {
          drawOutlinedText(ctx, label, w / 2, yPx, {
            font: '96px Graduate, CollegeBlock, system-ui, sans-serif',
            fillStyle: COLORS.icyBright,
            shadowColor: COLORS.icy,
            shadowBlur: 18,
            lineWidth: 16,
          });
        } else {
          ctx.font = '64px CollegeBlock, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.save();
          ctx.translate(72, yPx);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(String(label), 0, 0);
          ctx.restore();
          ctx.save();
          ctx.translate(w - 72, yPx);
          ctx.rotate(Math.PI / 2);
          ctx.fillText(String(label), 0, 0);
          ctx.restore();
        }

        // Midfield mark
        if (yard === ENDZONE_DEPTH_YARDS + 50) {
          drawOutlinedText(ctx, 'F10', w / 2, yPx, {
            font: '140px Graduate, CollegeBlock, system-ui, sans-serif',
            fillStyle: COLORS.icyBright,
            shadowColor: COLORS.icy,
            shadowBlur: 20,
            lineWidth: 18,
          });
        }

        ctx.restore();
      }
    }
    ctx.restore();

    // Vignette
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    ctx.save();
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0.10)');
    g.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = g;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    setRendered(true);
  }, [ticks]);

  const download = (type) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mime = type === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvas.toDataURL(mime, type === 'jpg' ? 0.92 : undefined);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = type === 'png' ? 'first-and-10-field-full.png' : 'first-and-10-field-full.jpg';
    a.click();
  };

  if (!user) return null;

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      {/* Preload Graduate so canvas has it */}
      <span className={graduate.className} aria-hidden="true" style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
        .
      </span>

      <div className="space-y-4">
        <div className="f10-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl f10-title text-white">Field Still (Full Length)</h1>
              <p className="text-sm text-gray-400">Renders a full 120-yard still (no arrows) and lets you download it.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => download('png')}
                disabled={!rendered}
                className="px-4 py-2 rounded-xl text-sm text-white disabled:opacity-50"
                style={{ background: 'rgba(0,229,255,0.18)', border: '1px solid rgba(0,229,255,0.22)' }}
              >
                Download PNG
              </button>
              <button
                type="button"
                onClick={() => download('jpg')}
                disabled={!rendered}
                className="px-4 py-2 rounded-xl text-sm text-white disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Download JPEG
              </button>
            </div>
          </div>
        </div>

        <div className="f10-panel p-3 overflow-auto">
          <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 960, height: 'auto', display: 'block', margin: '0 auto' }} />
          <div className="text-xs text-gray-500 text-center mt-2">Preview is scaled down; downloads are full resolution.</div>
        </div>
      </div>
    </Layout>
  );
}

