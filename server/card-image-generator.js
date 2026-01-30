/**
 * Card Image Generator
 * =====================
 * Generates SVG card images using the tier-based templates
 */

const fs = require('fs');
const path = require('path');
const { buildTieredCardSVG, getTierConfig } = require('./nft-generator/tier-templates');

// Directory to store generated card images
const IMAGES_DIR = path.join(__dirname, '../public/cards');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

/**
 * Generate a unique filename for a card
 */
function getCardFilename(card) {
  const playerName = (card.player || card.player_name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 30);
  const season = card.season || 0;
  return `${playerName}_${season}.svg`;
}

/**
 * Get the public URL for a card image
 */
function getCardImageUrl(card) {
  const filename = getCardFilename(card);
  return `/cards/${filename}`;
}

/**
 * Convert normalized player data to card format for SVG generation
 */
function playerToCardFormat(player) {
  const stats = {};
  
  // Map normalized stats to display-friendly stats based on position
  const pos = player.position || player.pos_group || 'Unknown';
  
  if (pos === 'QB') {
    if (player.pass_yds_pg) stats.passing_yards = Math.round(player.pass_yds_pg * (player.g || 16));
    if (player.pass_td_pg) stats.passing_td = Math.round(player.pass_td_pg * (player.g || 16));
    if (player.int_pg) stats.interceptions = Math.round(player.int_pg * (player.g || 16));
    if (player.rush_yds_pg) stats.rushing_yards = Math.round(player.rush_yds_pg * (player.g || 16));
    if (player.rush_td_pg) stats.rushing_td = Math.round(player.rush_td_pg * (player.g || 16));
  } else if (pos === 'RB') {
    if (player.rush_yds_pg) stats.rushing_yards = Math.round(player.rush_yds_pg * (player.g || 16));
    if (player.rush_td_pg) stats.rushing_td = Math.round(player.rush_td_pg * (player.g || 16));
    if (player.rec_yds_pg) stats.receiving_yards = Math.round(player.rec_yds_pg * (player.g || 16));
    if (player.rec_td_pg) stats.receiving_td = Math.round(player.rec_td_pg * (player.g || 16));
    if (player.scrimmage_yds_pg) stats.total_yards = Math.round(player.scrimmage_yds_pg * (player.g || 16));
  } else if (pos === 'WR' || pos === 'TE') {
    if (player.rec_yds_pg) stats.receiving_yards = Math.round(player.rec_yds_pg * (player.g || 16));
    if (player.rec_td_pg) stats.receiving_td = Math.round(player.rec_td_pg * (player.g || 16));
    if (player.rec_pg) stats.receptions = Math.round(player.rec_pg * (player.g || 16));
    if (player['receiving_y_r']) stats.yards_per_reception = player['receiving_y_r'];
  } else if (pos === 'K') {
    if (player.fgm_pg) stats.field_goals_made = Math.round(player.fgm_pg * (player.g || 16));
    if (player.fga_pg) stats.field_goals_att = Math.round(player.fga_pg * (player.g || 16));
    if (player['scoring_fg%']) stats.fg_percentage = player['scoring_fg%'];
    if (player.xpm_pg) stats.extra_points_made = Math.round(player.xpm_pg * (player.g || 16));
  } else if (pos === 'P') {
    if (player.punt_pg) stats.punts = Math.round(player.punt_pg * (player.g || 16));
    if (player.punt_yds_pg) stats.punt_yards = Math.round(player.punt_yds_pg * (player.g || 16));
  } else {
    // Defense
    if (player.tackles_pg) stats.tackles = Math.round(player.tackles_pg * (player.g || 16));
    if (player.sacks_pg) stats.sacks = Math.round(player.sacks_pg * (player.g || 16) * 10) / 10;
    if (player.int_pg) stats.interceptions = Math.round(player.int_pg * (player.g || 16));
    if (player.pd_pg) stats.passes_defended = Math.round(player.pd_pg * (player.g || 16));
    if (player.ff_pg) stats.forced_fumbles = Math.round(player.ff_pg * (player.g || 16));
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
 * Generate SVG for a card and save to file
 */
function generateCardImage(player) {
  const cardData = playerToCardFormat(player);
  const svg = buildTieredCardSVG(cardData);
  
  const filename = getCardFilename(player);
  const filepath = path.join(IMAGES_DIR, filename);
  
  fs.writeFileSync(filepath, svg);
  
  return getCardImageUrl(player);
}

/**
 * Check if card image already exists
 */
function cardImageExists(player) {
  const filename = getCardFilename(player);
  const filepath = path.join(IMAGES_DIR, filename);
  return fs.existsSync(filepath);
}

/**
 * Get or generate card image
 * Returns the URL to the card image
 */
function getOrGenerateCardImage(player) {
  if (!cardImageExists(player)) {
    return generateCardImage(player);
  }
  return getCardImageUrl(player);
}

/**
 * Generate images for multiple cards (batch)
 */
function generateBatchCardImages(players) {
  const results = [];
  
  for (const player of players) {
    try {
      const url = getOrGenerateCardImage(player);
      results.push({ player: player.player, season: player.season, url, success: true });
    } catch (err) {
      results.push({ player: player.player, season: player.season, error: err.message, success: false });
    }
  }
  
  return results;
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

module.exports = {
  generateCardImage,
  getCardImageUrl,
  getOrGenerateCardImage,
  cardImageExists,
  generateBatchCardImages,
  playerToCardFormat,
  getTierInfo,
  IMAGES_DIR,
};
