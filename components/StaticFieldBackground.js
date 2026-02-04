/**
 * Static field background for live environment.
 * Same look as PlayfieldBackground but no scroll, no arrows – "First & 10" end zone at top,
 * yard lines fill viewport only (nothing beyond bottom of screen).
 */
import React, { useEffect, useRef } from 'react';

const COLORS = {
  field: '#06080A',
  icy: '#8FD9FF',
  icyBright: '#C7EEFF',
};
const pxPerYard = 18;
const ENDZONE_DEPTH_YARDS = 10;
const yardsPerTick = 5;
const BG_DIM = 0.62;

function drawOutlinedText(ctx, text, x, y, opts) {
  const {
    font,
    fillStyle,
    strokeStyle = 'rgba(0,0,0,0.72)',
    lineWidth = 10,
    shadowColor,
    shadowBlur = 12,
  } = opts || {};

  ctx.save();
  if (font) ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 0;
  ctx.strokeStyle = strokeStyle;
  ctx.lineJoin = 'round';
  ctx.lineWidth = lineWidth;
  ctx.strokeText(String(text), x, y);
  if (shadowColor) ctx.shadowColor = shadowColor;
  ctx.shadowBlur = shadowBlur;
  if (fillStyle) ctx.fillStyle = fillStyle;
  ctx.fillText(String(text), x, y);
  ctx.restore();
}

export default function StaticFieldBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = COLORS.field;
      ctx.fillRect(0, 0, w, h);

      const endzoneH = ENDZONE_DEPTH_YARDS * pxPerYard;
      const xStart = 20;
      const xEnd = w - 20;

      // End zone rect (no dots animation – static)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(143, 217, 255, 0.08)';
      ctx.fillRect(0, 0, w, endzoneH);
      ctx.strokeStyle = COLORS.icy;
      ctx.shadowColor = COLORS.icy;
      ctx.shadowBlur = 32;
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.9 * BG_DIM;
      ctx.strokeRect(0, 0, w, endzoneH);
      ctx.restore();

      // "FIRST & 10" in end zone
      ctx.save();
      ctx.fillStyle = COLORS.icyBright;
      ctx.shadowColor = COLORS.icy;
      ctx.shadowBlur = 16;
      drawOutlinedText(ctx, 'FIRST & 10', w / 2, endzoneH / 2, {
        font: '64px Graduate, CollegeBlock, system-ui, sans-serif',
        fillStyle: COLORS.icyBright,
        shadowColor: COLORS.icy,
        shadowBlur: 16,
        strokeStyle: 'rgba(0,0,0,0.72)',
        lineWidth: 12,
      });
      ctx.restore();

      // Yard lines from goal line (y = endzoneH) down to bottom of viewport only
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = COLORS.icy;
      ctx.shadowColor = COLORS.icy;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.55 * BG_DIM;

      for (let yard = 0; yard <= 100; yard += yardsPerTick) {
        const yPx = endzoneH + yard * pxPerYard;
        if (yPx > h) break;

        const isGoal = yard === 0;
        const label = yard % 10 === 0 ? (yard <= 50 ? yard : 100 - yard) : null;

        let segStart = xStart;
        let segEnd = xEnd;
        if (isGoal) {
          const pad = 80;
          const labelW = 320;
          segStart = w / 2 - labelW / 2 - pad;
          segEnd = w / 2 + labelW / 2 + pad;
          if (xStart < segStart) {
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

        for (let i = 4; i < 12; i++) {
          const yy = yPx + i * 6;
          if (yy > h) break;
          ctx.beginPath();
          ctx.moveTo(10, yy);
          ctx.lineTo(16, yy);
          ctx.moveTo(w - 16, yy);
          ctx.lineTo(w - 10, yy);
          ctx.stroke();
        }

        if (label != null && yard > 0) {
          ctx.save();
          ctx.fillStyle = COLORS.icyBright;
          ctx.shadowColor = COLORS.icy;
          ctx.shadowBlur = 12;
          ctx.font = '48px CollegeBlock, system-ui, sans-serif';
          ctx.translate(40, yPx);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(label), 0, 0);
          ctx.restore();
          ctx.save();
          ctx.fillStyle = COLORS.icyBright;
          ctx.shadowColor = COLORS.icy;
          ctx.shadowBlur = 12;
          ctx.font = '48px CollegeBlock, system-ui, sans-serif';
          ctx.translate(w - 40, yPx);
          ctx.rotate(Math.PI / 2);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(label), 0, 0);
          ctx.restore();
        }
      }

      ctx.restore();

      // Dim overlay + vignette (match PlayfieldBackground)
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      ctx.save();
      const g = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.2,
        w / 2, h / 2, Math.max(w, h) * 0.85
      );
      g.addColorStop(0, 'rgba(0,0,0,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0.58)');
      ctx.fillStyle = g;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        width: '100vw',
        height: '100vh',
        background: COLORS.field,
      }}
    />
  );
}
