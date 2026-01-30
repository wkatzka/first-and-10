/**
 * Generate PWA icons for First & 10
 * Creates PNG icons at various sizes using SVG as source
 */

const fs = require('fs');
const path = require('path');

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 167, 180, 192, 384, 512];

// Generate SVG icon
function generateSVG(size) {
  const padding = size * 0.1;
  const innerSize = size - (padding * 2);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="50%" style="stop-color:#16213e"/>
      <stop offset="100%" style="stop-color:#0f0f1a"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffd700"/>
      <stop offset="50%" style="stop-color:#ffed4a"/>
      <stop offset="100%" style="stop-color:#f59e0b"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#bg)"/>
  
  <!-- Border -->
  <rect x="${size * 0.03}" y="${size * 0.03}" width="${size * 0.94}" height="${size * 0.94}" rx="${size * 0.18}" fill="none" stroke="url(#gold)" stroke-width="${size * 0.02}"/>
  
  <!-- Football shape -->
  <ellipse cx="${size / 2}" cy="${size / 2}" rx="${size * 0.28}" ry="${size * 0.18}" fill="#8B4513" transform="rotate(-30 ${size / 2} ${size / 2})"/>
  <ellipse cx="${size / 2}" cy="${size / 2}" rx="${size * 0.26}" ry="${size * 0.16}" fill="#A0522D" transform="rotate(-30 ${size / 2} ${size / 2})"/>
  
  <!-- Laces -->
  <line x1="${size * 0.42}" y1="${size * 0.38}" x2="${size * 0.58}" y2="${size * 0.62}" stroke="white" stroke-width="${size * 0.015}" stroke-linecap="round"/>
  <line x1="${size * 0.44}" y1="${size * 0.44}" x2="${size * 0.48}" y2="${size * 0.42}" stroke="white" stroke-width="${size * 0.012}" stroke-linecap="round"/>
  <line x1="${size * 0.48}" y1="${size * 0.48}" x2="${size * 0.52}" y2="${size * 0.46}" stroke="white" stroke-width="${size * 0.012}" stroke-linecap="round"/>
  <line x1="${size * 0.52}" y1="${size * 0.54}" x2="${size * 0.56}" y2="${size * 0.52}" stroke="white" stroke-width="${size * 0.012}" stroke-linecap="round"/>
  
  <!-- "1st" text -->
  <text x="${size * 0.5}" y="${size * 0.88}" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="${size * 0.14}" font-weight="bold" fill="url(#gold)">1st &amp; 10</text>
</svg>`;
}

// Generate splash screen SVG
function generateSplashSVG(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="50%" style="stop-color:#16213e"/>
      <stop offset="100%" style="stop-color:#0f0f1a"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ffd700"/>
      <stop offset="50%" style="stop-color:#ffed4a"/>
      <stop offset="100%" style="stop-color:#f59e0b"/>
    </linearGradient>
  </defs>
  
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  
  <!-- Football -->
  <ellipse cx="${width / 2}" cy="${height / 2 - 50}" rx="80" ry="50" fill="#8B4513" transform="rotate(-30 ${width / 2} ${height / 2 - 50})"/>
  <ellipse cx="${width / 2}" cy="${height / 2 - 50}" rx="75" ry="45" fill="#A0522D" transform="rotate(-30 ${width / 2} ${height / 2 - 50})"/>
  
  <!-- Laces -->
  <line x1="${width / 2 - 20}" y1="${height / 2 - 70}" x2="${width / 2 + 20}" y2="${height / 2 - 30}" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <line x1="${width / 2 - 15}" y1="${height / 2 - 60}" x2="${width / 2 - 5}" y2="${height / 2 - 65}" stroke="white" stroke-width="3" stroke-linecap="round"/>
  <line x1="${width / 2 - 5}" y1="${height / 2 - 50}" x2="${width / 2 + 5}" y2="${height / 2 - 55}" stroke="white" stroke-width="3" stroke-linecap="round"/>
  <line x1="${width / 2 + 5}" y1="${height / 2 - 40}" x2="${width / 2 + 15}" y2="${height / 2 - 45}" stroke="white" stroke-width="3" stroke-linecap="round"/>
  
  <!-- Title -->
  <text x="${width / 2}" y="${height / 2 + 60}" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="48" font-weight="bold" fill="url(#gold)">FIRST &amp; 10</text>
  <text x="${width / 2}" y="${height / 2 + 95}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#9CA3AF">Football Card Game</text>
</svg>`;
}

const iconsDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate icons
sizes.forEach(size => {
  const svg = generateSVG(size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.svg`), svg);
  console.log(`Generated icon-${size}.svg`);
});

// Generate apple touch icon (180px)
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.svg'), generateSVG(180));
console.log('Generated apple-touch-icon.svg');

// Generate splash screens
const splashSizes = [
  { name: 'splash-640x1136', w: 640, h: 1136 },
  { name: 'splash-750x1334', w: 750, h: 1334 },
  { name: 'splash-1242x2208', w: 1242, h: 2208 },
  { name: 'splash-1125x2436', w: 1125, h: 2436 },
];

splashSizes.forEach(({ name, w, h }) => {
  const svg = generateSplashSVG(w, h);
  fs.writeFileSync(path.join(iconsDir, `${name}.svg`), svg);
  console.log(`Generated ${name}.svg`);
});

// Generate a simple favicon (SVG)
fs.writeFileSync(path.join(iconsDir, 'favicon.svg'), generateSVG(32));
console.log('Generated favicon.svg');

console.log('\\nAll icons generated! Note: These are SVG files.');
console.log('For production, you may want to convert them to PNG using a tool like sharp or an online converter.');
