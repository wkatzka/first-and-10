/**
 * 10 Tier-based SVG templates for NFL player cards.
 * Tier 10 = Best (Legendary), Tier 1 = Lowest (Common)
 */

const TIER_CONFIG = {
  10: {
    name: "Legendary",
    gradient: ["#FFD700", "#FFA500", "#FF8C00"],
    border: "#FFD700",
    borderWidth: 5,
    glow: true,
    badge: "★★★★★",
    bgPattern: "legendary",
  },
  9: {
    name: "Epic",
    gradient: ["#9400D3", "#8A2BE2", "#4B0082"],
    border: "#9400D3",
    borderWidth: 4,
    glow: true,
    badge: "★★★★",
    bgPattern: "epic",
  },
  8: {
    name: "Ultra Rare",
    gradient: ["#DC143C", "#B22222", "#8B0000"],
    border: "#DC143C",
    borderWidth: 4,
    glow: true,
    badge: "★★★★",
    bgPattern: "ultrarare",
  },
  7: {
    name: "Very Rare",
    gradient: ["#FF8C00", "#FF6347", "#FF4500"],
    border: "#FF8C00",
    borderWidth: 3,
    glow: false,
    badge: "★★★",
    bgPattern: "veryrare",
  },
  6: {
    name: "Rare",
    gradient: ["#1E90FF", "#4169E1", "#0000CD"],
    border: "#1E90FF",
    borderWidth: 3,
    glow: false,
    badge: "★★★",
    bgPattern: "rare",
  },
  5: {
    name: "Uncommon+",
    gradient: ["#20B2AA", "#008B8B", "#006666"],
    border: "#20B2AA",
    borderWidth: 2,
    glow: false,
    badge: "★★",
    bgPattern: "uncommonplus",
  },
  4: {
    name: "Uncommon",
    gradient: ["#32CD32", "#228B22", "#006400"],
    border: "#32CD32",
    borderWidth: 2,
    glow: false,
    badge: "★★",
    bgPattern: "uncommon",
  },
  3: {
    name: "Common+",
    gradient: ["#C0C0C0", "#A9A9A9", "#808080"],
    border: "#C0C0C0",
    borderWidth: 2,
    glow: false,
    badge: "★",
    bgPattern: "commonplus",
  },
  2: {
    name: "Common",
    gradient: ["#CD853F", "#8B7355", "#6B4423"],
    border: "#CD853F",
    borderWidth: 2,
    glow: false,
    badge: "★",
    bgPattern: "common",
  },
  1: {
    name: "Basic",
    gradient: ["#696969", "#505050", "#2F2F2F"],
    border: "#696969",
    borderWidth: 1,
    glow: false,
    badge: "",
    bgPattern: "basic",
  },
};

function getTierConfig(tier) {
  return TIER_CONFIG[tier] || TIER_CONFIG[1];
}

function escape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Build the background pattern/effects based on tier
 */
function buildBackground(tier, width, height) {
  const config = getTierConfig(tier);
  const [color1, color2, color3] = config.gradient;

  let pattern = "";
  let extraDefs = "";

  // Base gradient
  extraDefs += `
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color1};stop-opacity:0.3"/>
      <stop offset="50%" style="stop-color:${color2};stop-opacity:0.2"/>
      <stop offset="100%" style="stop-color:${color3};stop-opacity:0.4"/>
    </linearGradient>
  `;

  // Tier-specific patterns
  if (tier >= 9) {
    // Legendary/Epic: Radial burst + shimmer lines
    extraDefs += `
      <radialGradient id="burst" cx="50%" cy="30%" r="60%">
        <stop offset="0%" style="stop-color:${color1};stop-opacity:0.4"/>
        <stop offset="100%" style="stop-color:${color3};stop-opacity:0"/>
      </radialGradient>
    `;
    pattern += `<ellipse cx="${width / 2}" cy="${height * 0.3}" rx="${width * 0.7}" ry="${height * 0.4}" fill="url(#burst)"/>`;

    // Shimmer lines
    for (let i = 0; i < 8; i++) {
      const x = (width / 9) * (i + 1);
      pattern += `<line x1="${x}" y1="0" x2="${x - 40}" y2="${height}" stroke="${color1}" stroke-width="1" opacity="0.15"/>`;
    }
  } else if (tier >= 7) {
    // Very Rare / Ultra Rare: Diagonal stripes
    for (let i = 0; i < 12; i++) {
      const offset = i * 60 - 200;
      pattern += `<line x1="${offset}" y1="0" x2="${offset + height}" y2="${height}" stroke="${color1}" stroke-width="2" opacity="0.1"/>`;
    }
  } else if (tier >= 5) {
    // Rare / Uncommon+: Subtle dots
    extraDefs += `
      <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
        <circle cx="15" cy="15" r="2" fill="${color1}" opacity="0.15"/>
      </pattern>
    `;
    pattern += `<rect width="100%" height="100%" fill="url(#dots)"/>`;
  } else if (tier >= 3) {
    // Common+/Uncommon: Simple corner accents
    pattern += `
      <polygon points="0,0 80,0 0,80" fill="${color1}" opacity="0.1"/>
      <polygon points="${width},${height} ${width - 80},${height} ${width},${height - 80}" fill="${color1}" opacity="0.1"/>
    `;
  }
  // Tier 1-2: No extra pattern, just clean

  return { extraDefs, pattern };
}

/**
 * Build glow filter for high-tier cards
 */
function buildGlowFilter(tier) {
  const config = getTierConfig(tier);
  if (!config.glow) return "";

  return `
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  `;
}

/**
 * Build stat lines based on position
 */
function buildStatLines(stats, position) {
  const lines = [];

  if (position === "QB") {
    if (stats.passing_yards != null) lines.push(`Pass Yds: ${stats.passing_yards.toLocaleString()}`);
    if (stats.passing_td != null) lines.push(`Pass TD: ${stats.passing_td}`);
    if (stats.rushing_yards != null) lines.push(`Rush Yds: ${stats.rushing_yards.toLocaleString()}`);
    if (stats.rushing_td != null) lines.push(`Rush TD: ${stats.rushing_td}`);
    if (stats.interceptions != null) lines.push(`INT: ${stats.interceptions}`);
    if (stats.passer_rating != null) lines.push(`Rating: ${stats.passer_rating}`);
  } else if (["RB", "FB"].includes(position)) {
    if (stats.rushing_yards != null) lines.push(`Rush Yds: ${stats.rushing_yards.toLocaleString()}`);
    if (stats.rushing_td != null) lines.push(`Rush TD: ${stats.rushing_td}`);
    if (stats.receiving_yards != null) lines.push(`Rec Yds: ${stats.receiving_yards.toLocaleString()}`);
    if (stats.receiving_td != null) lines.push(`Rec TD: ${stats.receiving_td}`);
    if (stats.total_yards != null) lines.push(`Total Yds: ${stats.total_yards.toLocaleString()}`);
  } else if (["WR", "TE"].includes(position)) {
    if (stats.receiving_yards != null) lines.push(`Rec Yds: ${stats.receiving_yards.toLocaleString()}`);
    if (stats.receiving_td != null) lines.push(`Rec TD: ${stats.receiving_td}`);
    if (stats.receptions != null) lines.push(`Rec: ${stats.receptions}`);
    if (stats.yards_per_reception != null) lines.push(`Y/R: ${stats.yards_per_reception}`);
  } else if (["K", "P"].includes(position)) {
    if (stats.field_goals_made != null) lines.push(`FG: ${stats.field_goals_made}/${stats.field_goals_att || "?"}`);
    if (stats.fg_percentage != null) lines.push(`FG%: ${stats.fg_percentage}%`);
    if (stats.extra_points_made != null) lines.push(`XP: ${stats.extra_points_made}`);
    if (stats.punts != null) lines.push(`Punts: ${stats.punts}`);
    if (stats.punt_avg != null) lines.push(`Avg: ${stats.punt_avg}`);
  } else {
    // Defense / other
    if (stats.tackles != null) lines.push(`Tackles: ${stats.tackles}`);
    if (stats.sacks != null) lines.push(`Sacks: ${stats.sacks}`);
    if (stats.interceptions != null) lines.push(`INT: ${stats.interceptions}`);
    if (stats.passes_defended != null) lines.push(`PD: ${stats.passes_defended}`);
    if (stats.forced_fumbles != null) lines.push(`FF: ${stats.forced_fumbles}`);
  }

  // Fallback to any available stats
  if (lines.length === 0) {
    for (const [key, val] of Object.entries(stats)) {
      if (val != null && lines.length < 4) {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        lines.push(`${label}: ${typeof val === "number" ? val.toLocaleString() : val}`);
      }
    }
  }

  return lines.length > 0 ? lines : ["—"];
}

/**
 * Main function: Build SVG for a player card with tier-based styling
 */
function buildTieredCardSVG(card, options = {}) {
  const width = options.width ?? 512;
  const height = options.height ?? 720;
  const { name, season, team, position, stats = {}, tier = 1, score, photoUrl } = card;

  const config = getTierConfig(tier);
  const { extraDefs, pattern } = buildBackground(tier, width, height);
  const glowFilter = buildGlowFilter(tier);
  const statLines = buildStatLines(stats, position);

  const nameText = escape(name || "Unknown");
  const seasonText = escape(String(season));
  const teamText = escape(team || "—");
  const posText = escape(position || "—");
  const tierName = escape(config.name);
  const badgeText = config.badge;

  // Photo placeholder or embedded image - show position icon when no photo
  const positionEmoji = {
    'QB': '🏈', 'RB': '🏃', 'WR': '🎯', 'TE': '🤲', 'OL': '🛡️',
    'DL': '💪', 'LB': '🦅', 'DB': '🔒', 'K': '🦶'
  }[card.position] || '🏈';
  
  const photoSection = photoUrl
    ? `<image x="${width / 2 - 80}" y="100" width="160" height="200" href="${escape(photoUrl)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)"/>`
    : `<rect x="${width / 2 - 80}" y="100" width="160" height="200" fill="#222" rx="8"/>
       <circle cx="${width / 2}" cy="180" r="50" fill="${config.gradient[0]}"/>
       <text x="${width / 2}" y="195" text-anchor="middle" font-size="40">${positionEmoji}</text>
       <text x="${width / 2}" y="240" text-anchor="middle" fill="${config.gradient[0]}" font-family="system-ui, sans-serif" font-size="16" font-weight="bold">${card.position}</text>`;

  // Build stat text elements
  const statsStartY = 380;
  const statSpacing = 28;
  const statsElements = statLines
    .slice(0, 6)
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${statsStartY + i * statSpacing}" text-anchor="middle" fill="#ddd" font-family="system-ui, sans-serif" font-size="16">${escape(line)}</text>`
    )
    .join("\n    ");

  // Score display (if provided)
  const scoreDisplay = score != null 
    ? `<text x="${width - 30}" y="50" text-anchor="end" fill="${config.border}" font-family="system-ui, sans-serif" font-size="24" font-weight="bold">${Math.round(score)}</text>
       <text x="${width - 30}" y="68" text-anchor="end" fill="#888" font-family="system-ui, sans-serif" font-size="11">SCORE</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="50%" style="stop-color:#16213e"/>
      <stop offset="100%" style="stop-color:#0f0f1a"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${config.gradient[0]}"/>
      <stop offset="50%" style="stop-color:${config.gradient[1]}"/>
      <stop offset="100%" style="stop-color:${config.gradient[2]}"/>
    </linearGradient>
    <clipPath id="photoClip">
      <rect x="${width / 2 - 80}" y="100" width="160" height="200" rx="8"/>
    </clipPath>
    ${extraDefs}
    ${glowFilter}
  </defs>

  <!-- Card background -->
  <rect width="100%" height="100%" fill="url(#cardBg)" rx="16"/>
  
  <!-- Tier pattern overlay -->
  ${pattern}
  
  <!-- Card border -->
  <rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="url(#borderGrad)" stroke-width="${config.borderWidth}" rx="12" ${config.glow ? 'filter="url(#glow)"' : ""}/>

  <!-- Tier badge -->
  <rect x="20" y="20" width="120" height="32" fill="url(#borderGrad)" rx="6"/>
  <text x="80" y="42" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-size="14" font-weight="bold">${tierName}</text>
  
  <!-- Star rating -->
  <text x="80" y="70" text-anchor="middle" fill="${config.gradient[0]}" font-family="system-ui, sans-serif" font-size="18">${badgeText}</text>

  <!-- Score -->
  ${scoreDisplay}

  <!-- Player photo area -->
  ${photoSection}

  <!-- Player name -->
  <text x="${width / 2}" y="330" text-anchor="middle" fill="#fff" font-family="system-ui, sans-serif" font-size="28" font-weight="bold">${nameText}</text>
  
  <!-- Season · Team -->
  <text x="${width / 2}" y="358" text-anchor="middle" fill="${config.gradient[0]}" font-family="system-ui, sans-serif" font-size="18">${seasonText}  ·  ${teamText}  ·  ${posText}</text>

  <!-- Stats -->
  ${statsElements}

  <!-- Bottom decorative line -->
  <rect x="60" y="${height - 50}" width="${width - 120}" height="3" fill="url(#borderGrad)" rx="2"/>
  
  <!-- Card number placeholder -->
  <text x="${width / 2}" y="${height - 25}" text-anchor="middle" fill="#555" font-family="system-ui, sans-serif" font-size="12">FIRST & 10 · PLAYER CARD</text>
</svg>`;
}

module.exports = { buildTieredCardSVG, getTierConfig, TIER_CONFIG };
