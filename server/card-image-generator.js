/**
 * Card Image Generator
 * =====================
 * Generates card images using AI (DALL-E 3) or fallback SVG templates
 */

const fs = require('fs');
const path = require('path');
const { generateCardWithAI } = require('./ai-image-generator');
const { buildTieredCardSVG, getTierConfig } = require('./nft-generator/tier-templates');

// Directory to store generated card images
const IMAGES_DIR = path.join(__dirname, '../public/cards');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Check if AI generation is enabled
const AI_ENABLED = !!process.env.OPENAI_API_KEY;

/**
 * Generate a unique filename for a card
 */
function getCardFilename(card, extension = 'png') {
  const playerName = (card.player || card.player_name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 30);
  const season = card.season || 0;
  return `${playerName}_${season}.${extension}`;
}

/**
 * Get the public URL for a card image
 */
function getCardImageUrl(card) {
  const extension = AI_ENABLED ? 'png' : 'svg';
  const filename = getCardFilename(card, extension);
  return `/cards/${filename}`;
}

/**
 * Convert normalized player data to card format
 */
function playerToCardFormat(player) {
  const pos = player.position || player.pos_group || 'Unknown';
  const games = player.g || 16;
  
  // Build stats object with consistent formatting
  const stats = {};
  
  if (pos === 'QB') {
    if (player.pass_yds_pg) stats.pass_yds = Math.round(player.pass_yds_pg * games);
    if (player.pass_td_pg) stats.pass_td = Math.round(player.pass_td_pg * games);
    if (player.int_pg) stats.int = Math.round(player.int_pg * games);
    if (player.rush_yds_pg) stats.rush_yds = Math.round(player.rush_yds_pg * games);
  } else if (pos === 'RB') {
    if (player.rush_yds_pg) stats.rush_yds = Math.round(player.rush_yds_pg * games);
    if (player.rush_td_pg) stats.rush_td = Math.round(player.rush_td_pg * games);
    if (player.rec_yds_pg) stats.rec_yds = Math.round(player.rec_yds_pg * games);
    if (player.rec_pg) stats.rec = Math.round(player.rec_pg * games);
  } else if (pos === 'WR' || pos === 'TE') {
    if (player.rec_pg) stats.rec = Math.round(player.rec_pg * games);
    if (player.rec_yds_pg) stats.rec_yds = Math.round(player.rec_yds_pg * games);
    if (player.rec_td_pg) stats.rec_td = Math.round(player.rec_td_pg * games);
  } else if (pos === 'K') {
    if (player.fgm_pg) stats.fg = Math.round(player.fgm_pg * games);
    if (player['scoring_fg%']) stats.fg_pct = Math.round(player['scoring_fg%']) + '%';
    if (player.xpm_pg) stats.xp = Math.round(player.xpm_pg * games);
  } else if (pos === 'DL' || pos === 'LB' || pos === 'DB' || pos === 'OL') {
    if (player.tackles_pg) stats.tkl = Math.round(player.tackles_pg * games);
    if (player.sacks_pg) stats.sack = Math.round(player.sacks_pg * games * 10) / 10;
    if (player.int_pg) stats.int = Math.round(player.int_pg * games);
    if (player.pd_pg) stats.pd = Math.round(player.pd_pg * games);
    if (player.ff_pg) stats.ff = Math.round(player.ff_pg * games);
  }
  
  return {
    name: player.player || player.player_name || 'Unknown',
    season: player.season,
    team: player.team || 'N/A',
    position: pos,
    tier: player.tier || 1,
    score: player.composite_score,
    stats,
  };
}

/**
 * Generate SVG card (fallback when AI not available)
 */
function generateSVGCard(player) {
  const cardData = playerToCardFormat(player);
  const svg = buildTieredCardSVG(cardData);
  
  const filename = getCardFilename(player, 'svg');
  const filepath = path.join(IMAGES_DIR, filename);
  
  fs.writeFileSync(filepath, svg);
  
  return `/cards/${filename}`;
}

/**
 * Generate AI card image using DALL-E 3
 */
async function generateAICard(player) {
  const cardData = playerToCardFormat(player);
  const filename = getCardFilename(player, 'png');
  const filepath = path.join(IMAGES_DIR, filename);
  
  try {
    await generateCardWithAI({
      name: cardData.name,
      team: cardData.team,
      position: cardData.position,
      season: cardData.season,
      tier: cardData.tier,
      score: cardData.score,
      stats: cardData.stats,
    }, filepath, {
      apiKey: process.env.OPENAI_API_KEY,
      size: '1024x1792',
      quality: 'standard',
    });
    
    console.log(`AI image generated: ${filename}`);
    return `/cards/${filename}`;
  } catch (err) {
    console.error(`AI generation failed for ${cardData.name}: ${err.message}`);
    // Fallback to SVG
    return generateSVGCard(player);
  }
}

/**
 * Check if card image already exists
 */
function cardImageExists(player) {
  const pngPath = path.join(IMAGES_DIR, getCardFilename(player, 'png'));
  const svgPath = path.join(IMAGES_DIR, getCardFilename(player, 'svg'));
  return fs.existsSync(pngPath) || fs.existsSync(svgPath);
}

/**
 * Get existing card image URL if it exists
 */
function getExistingCardUrl(player) {
  const pngPath = path.join(IMAGES_DIR, getCardFilename(player, 'png'));
  const svgPath = path.join(IMAGES_DIR, getCardFilename(player, 'svg'));
  
  if (fs.existsSync(pngPath)) {
    return `/cards/${getCardFilename(player, 'png')}`;
  }
  if (fs.existsSync(svgPath)) {
    return `/cards/${getCardFilename(player, 'svg')}`;
  }
  return null;
}

/**
 * Get or generate card image (async for AI support)
 * Returns the URL to the card image
 */
async function getOrGenerateCardImage(player) {
  // Check if already exists
  const existingUrl = getExistingCardUrl(player);
  if (existingUrl) {
    return existingUrl;
  }
  
  // Generate new image
  if (AI_ENABLED) {
    return await generateAICard(player);
  } else {
    return generateSVGCard(player);
  }
}

/**
 * Sync version for when we need immediate result (uses SVG fallback)
 */
function getOrGenerateCardImageSync(player) {
  const existingUrl = getExistingCardUrl(player);
  if (existingUrl) {
    return existingUrl;
  }
  return generateSVGCard(player);
}

/**
 * Get tier configuration for display
 */
function getTierInfo(tier) {
  const config = getTierConfig(tier);
  return {
    name: config.name,
    color: config.gradient[0],
    badge: config.badge,
  };
}

/**
 * Get formatted stats for display on card back
 */
function getFormattedStats(player) {
  const cardData = playerToCardFormat(player);
  const formatted = [];
  
  const labels = {
    pass_yds: 'Pass Yards',
    pass_td: 'Pass TD',
    int: 'INT',
    rush_yds: 'Rush Yards',
    rush_td: 'Rush TD',
    rec: 'Receptions',
    rec_yds: 'Rec Yards',
    rec_td: 'Rec TD',
    fg: 'Field Goals',
    fg_pct: 'FG %',
    xp: 'Extra Points',
    tkl: 'Tackles',
    sack: 'Sacks',
    pd: 'Pass Def',
    ff: 'Forced Fum',
  };
  
  for (const [key, value] of Object.entries(cardData.stats)) {
    if (value != null && value !== 0) {
      formatted.push({
        label: labels[key] || key.toUpperCase(),
        value: value,
      });
    }
  }
  
  return formatted;
}

module.exports = {
  generateSVGCard,
  generateAICard,
  getCardImageUrl,
  getOrGenerateCardImage,
  getOrGenerateCardImageSync,
  cardImageExists,
  playerToCardFormat,
  getTierInfo,
  getFormattedStats,
  IMAGES_DIR,
  AI_ENABLED,
};
