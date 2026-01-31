/**
 * Era-Tier Illustrated Trading Card Prompt System
 * ================================================
 * Generates DALL-E prompts for NFL trading cards with:
 * - Classic trading card art style (NOT photorealistic)
 * - Player small in frame (40-50%), background dominates
 * - Era-specific equipment and visual styles
 * - Tier-specific poses (static → dynamic)
 * - Tier-specific backgrounds
 * - Player name for likeness (not as text)
 * - Ornate decorative frames
 */

// =============================================================================
// CORE STYLE RULES
// =============================================================================

const CORE_STYLE = `Premium NFL trading card, portrait orientation, stylized digital illustration classic trading card art style NOT photorealistic, chunky illustrated textures, player and background unified artistic style`;

const PLAYER_SIZE = `player very small distant figure taking up only 40% of card height, generous space around player, background dominates composition`;

const ANTI_TEXT_BLOCK = `absolutely no text anywhere on the image, no words, no letters, no numbers, no writing, no player name text, completely text-free, zero typography, blank jersey, no NFL logo, no team logos, no trademarked emblems, no helmet decals, no jersey numbers, plain uniform design`;

// =============================================================================
// ERA-SPECIFIC EQUIPMENT & STYLING
// =============================================================================

const ERAS = {
  "1920-1939": {
    name: "Leather Era",
    equipment: "soft leather helmet with no facemask, exposed face, canvas jersey with horizontal stripes, minimal padding, high-waisted canvas pants, high-top leather cleats, vintage 1920s gear",
    style: "sepia-tinted warm golden highlights, Art Deco geometric patterns",
    palette: "gold, cream, burgundy, bronze, brown",
    frameStyle: "ornate gold metallic frame Art Deco fan shapes sunburst rays",
  },
  "1940-1959": {
    name: "Post-War Era",
    equipment: "early plastic shell helmet, single-bar facemask, thick wool jersey, bulky leather shoulder pads visible, high-top black leather cleats, 1950s vintage gear",
    style: "propaganda poster aesthetic, bold saturated colors, heroic poses, military stencil influence",
    palette: "army green, navy blue, rust red, cream, sepia",
    frameStyle: "ornate bronze steel metallic frame military riveted details",
  },
  "1960-1977": {
    name: "Psychedelic Era",
    equipment: "Riddell-style suspension helmet, two-bar facemask, fitted polyester jersey, longer hair visible below helmet, lower-cut cleats, white tape on ankles, 1970s gear",
    style: "psychedelic swirls, organic flowing shapes, wavy distortion, groovy energy",
    palette: "burnt orange, avocado green, mustard yellow, deep purple, brown",
    frameStyle: "ornate bronze copper metallic frame wavy organic patterns",
  },
  "1978-1993": {
    name: "Synthwave Era",
    equipment: "full-cage facemask, polycarbonate helmet shell, tinted visor Oakley style, massive shoulder pads, eye black, wristbands, mesh jersey tight-fitting, 1980s gear",
    style: "hair metal chrome, Tron grid lines, Miami Vice gradients, neon tube lighting, laser effects",
    palette: "hot pink, electric cyan, neon green, chrome silver, black",
    frameStyle: "ornate chrome neon metallic frame angular 80s patterns holographic finish",
  },
  "1994-2003": {
    name: "Y2K Era",
    equipment: "Riddell Revolution helmet, streamlined shell, carbon fiber facemask, form-fitting stretch jersey, integrated pads, sleek 1990s gear",
    style: "Matrix digital rain, tribal tattoo patterns, liquid chrome surfaces, early CGI aesthetic",
    palette: "silver, electric blue, lime green, black, brushed metal",
    frameStyle: "ornate silver metallic frame tribal patterns cracked glass elements",
  },
  "2004-2010": {
    name: "Millennium Era",
    equipment: "Riddell Revolution style helmet, custom visor, form-fitting jersey, modern shoulder pads, 2000s gear",
    style: "clean minimalism, premium material feel, gradient meshes, sleek design",
    palette: "premium black, silver, accent neons, white",
    frameStyle: "ornate platinum metallic frame clean geometric patterns",
  },
  "2011-2019": {
    name: "High Tech Era",
    equipment: "Speedflex or Vicis-style helmet matte finish, compression undershirt visible, Nike style moisture-wicking jersey, custom anti-glare visor, modern gear",
    style: "clean minimalism, app-inspired elements, gradient meshes, premium material feel",
    palette: "premium black, subtle gradients, accent neons, white",
    frameStyle: "ornate chrome metallic frame geometric tech patterns sleek design",
  },
  "2020+": {
    name: "Hypermodern Era",
    equipment: "cutting-edge helmet with integrated sensors, futuristic vents, iridescent visor, seamless jersey construction, next-gen carbon fiber cleats, futuristic gear",
    style: "holographic overlays, AR/VR elements, glitch effects, volumetric lighting, NFT visual language",
    palette: "iridescent shifting colors, void black, electric accents",
    frameStyle: "ornate iridescent metallic frame futuristic curves color-shifting finish",
  },
};

// =============================================================================
// TIER-BASED POSES BY POSITION
// Higher tier = more dynamic, dramatic poses
// =============================================================================

const TIER_POSES = {
  QB: {
    low: ["under-center pre-snap stance", "standing pocket-ready ball at chest", "calm upright posture surveying field"],
    mid: ["classic mid-throw arm cocked", "short drop-back throwing stance", "slight rollout controlled motion"],
    high: ["full follow-through body extended", "rolling out under pressure", "throwing while absorbing contact", "jump throw off-platform"],
    elite: ["explosive follow-through dramatic extension", "no-look throw", "celebratory victory pose arm raised", "cinematic slow-motion throw with energy effects"],
  },
  RB: {
    low: ["standing with ball tucked", "simple forward running stride", "basic stance ball secured"],
    mid: ["straight-line run moderate lean", "ball secured forward motion", "basic cutting motion"],
    high: ["stiff-arm in full extension", "breaking tackle explosive", "lateral cut evading defender"],
    elite: ["multiple defenders evaded", "mid-air leap over defender", "breaking free with trailing energy effects"],
  },
  WR: {
    low: ["standing ready stance", "jogging route pose", "basic catch position"],
    mid: ["catch at chest level", "low jump catch", "turning upfield after catch"],
    high: ["full extension catch", "sideline toe-tap catch", "diving catch horizontal"],
    elite: ["one-handed grab spectacular", "horizontal full-body extension", "mid-air collision catch through contact"],
  },
  TE: {
    low: ["standing with ball", "basic route stance", "upright catching position"],
    mid: ["catching over middle upright", "turning upfield", "securing catch"],
    high: ["catch while being hit", "breaking tackle after catch", "stiff-arm through contact"],
    elite: ["trucking defender", "high-point catch in traffic", "explosive power-through pose"],
  },
  OL: {
    low: ["set pass-protection stance", "hands up feet planted", "three-point stance"],
    mid: ["engaged block pushing", "forward drive motion", "anchored protection"],
    high: ["pancake block finishing", "pulling around end", "double-team dominating"],
    elite: ["explosive drive-block", "clearing path dramatically", "dominant finishing block"],
  },
  DL: {
    low: ["three-point stance ready", "hands up defensive position", "anchored stance"],
    mid: ["engaged with blocker", "swim move beginning", "bull rush push"],
    high: ["shedding block aggressively", "pass rush explosion", "pursuing quarterback"],
    elite: ["sack celebration", "strip-sack dramatic", "game-changing play explosion"],
  },
  LB: {
    low: ["standing ready position", "basic tackling stance", "reading offense"],
    mid: ["closing on ball carrier", "filling gap", "basic tackle form"],
    high: ["wrap-up tackle impact", "blitzing through gap", "deflecting pass"],
    elite: ["bone-crushing hit", "interception spectacular", "goal-line stand heroic"],
  },
  DB: {
    low: ["backpedal stance", "zone coverage position", "ready stance alert"],
    mid: ["breaking on ball", "man coverage tight", "closing on receiver"],
    high: ["pass breakup hand on ball", "diving for interception", "hit on receiver"],
    elite: ["pick-six running back", "one-handed interception", "game-sealing play dramatic"],
  },
  K: {
    low: ["standing with ball", "pre-kick stance", "measuring steps"],
    mid: ["approach to ball", "plant foot down", "beginning kick motion"],
    high: ["leg extended follow-through", "ball just leaving foot", "full kick extension"],
    elite: ["game-winning kick celebration", "dramatic follow-through", "clutch moment frozen"],
  },
  P: {
    low: ["holding ball ready", "pre-punt stance", "measuring distance"],
    mid: ["ball drop beginning", "leg swinging back", "approach motion"],
    high: ["mid-punt leg extended", "ball contact moment", "full punt follow-through"],
    elite: ["booming punt dramatic arc", "coffin-corner precision", "clutch punt celebration"],
  },
};

/**
 * Get pose based on tier level
 */
function getTierPose(position, tier) {
  const poses = TIER_POSES[position] || TIER_POSES.QB;
  let category;
  
  if (tier <= 2) category = 'low';
  else if (tier <= 5) category = 'mid';
  else if (tier <= 8) category = 'high';
  else category = 'elite'; // 9, 10, 11 (HOF)
  
  const options = poses[category];
  return options[Math.floor(Math.random() * options.length)];
}

// =============================================================================
// TIER-SPECIFIC BACKGROUNDS & FRAMES
// =============================================================================

const TIER_BACKGROUNDS = {
  11: {
    name: "Hall of Fame",
    background: "stylized swirling deep space nebula with chunky bold painted cosmic clouds, illustrated galaxies and stars surrounding distant player figure, cosmic purple blue pink energy emanating",
    intensity: "transcendent legendary cosmic eternal",
  },
  10: {
    name: "Legendary",
    background: "stylized fireworks explosions with chunky bold painted bursts surrounding distant player figure, sparks and light trails wrapping around, player glowing with firework light",
    intensity: "explosive triumphant celebratory legendary",
  },
  9: {
    name: "Epic",
    background: "stylized swirling iridescent oil-slick with chunky bold painted rainbow patterns flowing around distant player figure, illustrated color-shifting pink cyan gold purple wrapping around, holographic energy emanating",
    intensity: "spectacular otherworldly mesmerizing epic",
  },
  8: {
    name: "Ultra Rare",
    background: "stylized dramatic thunderstorm with chunky bold painted lightning bolts forking around distant player figure, illustrated storm clouds swirling, electrical energy crackling around",
    intensity: "powerful electric dramatic raw",
  },
  7: {
    name: "Very Rare",
    background: "stylized sparkly gold background with chunky painted gold flakes and bold gold dust swirling around distant player figure, illustrated Art Deco sunburst rays behind, golden glow emanating",
    intensity: "prestigious valuable gleaming",
  },
  6: {
    name: "Rare",
    background: "stylized shattered glass with chunky bold painted glass shards flying around distant player figure, illustrated impact cracks radiating, dramatic breakthrough moment",
    intensity: "explosive dynamic breakthrough",
  },
  5: {
    name: "Uncommon+",
    background: "stylized chrome background with chunky bold painted circuit patterns surrounding distant player figure, illustrated LED traces flowing around",
    intensity: "technical modern sleek",
  },
  4: {
    name: "Uncommon",
    background: "stylized brushed stainless steel background behind distant player figure, illustrated industrial metal texture, cool neutral tones",
    intensity: "solid industrial dependable",
  },
  3: {
    name: "Common+",
    background: "simple stylized brushed bronze metallic background behind distant player figure, matte bronze texture, warm understated tones",
    intensity: "warm simple honest",
  },
  2: {
    name: "Common",
    background: "simple stylized matte painted background behind distant player figure, solid neutral color, basic studio setup",
    intensity: "clean simple basic",
  },
  1: {
    name: "Basic",
    background: "plain stylized wood grain background behind distant player figure, simple illustrated plywood texture, basic utilitarian",
    intensity: "plain basic unglamorous lowest tier",
  },
};

// =============================================================================
// PROMPT BUILDER
// =============================================================================

/**
 * Build a complete illustrated trading card DALL-E prompt
 * @param {Object} card - Card data with player, position, tier, season, team
 * @returns {string} - Complete DALL-E prompt
 */
function buildPhotorealisticPrompt(card) {
  const position = card.position || card.pos_group || 'QB';
  const tier = card.tier || 5;
  const season = card.season || 2020;
  const playerName = card.player || card.name || 'football player';
  const team = card.team || '';
  
  // Determine era from season
  let era;
  if (season < 1940) era = "1920-1939";
  else if (season < 1960) era = "1940-1959";
  else if (season < 1978) era = "1960-1977";
  else if (season < 1994) era = "1978-1993";
  else if (season < 2004) era = "1994-2003";
  else if (season < 2011) era = "2004-2010";
  else if (season < 2020) era = "2011-2019";
  else era = "2020+";
  
  const eraConfig = ERAS[era] || ERAS["2020+"];
  const tierConfig = TIER_BACKGROUNDS[tier] || TIER_BACKGROUNDS[5];
  const pose = getTierPose(position, tier);
  
  // Build player description with name for likeness
  const playerDesc = `${playerName} athletic ${getPositionFullName(position)}`;
  
  // Get team-inspired colors (generic, no logos)
  const uniformColors = getTeamInspiredColors(team) || eraConfig.palette.split(', ').slice(0, 2).join(' and ');
  
  // Build the prompt
  const prompt = [
    CORE_STYLE,
    playerDesc,
    PLAYER_SIZE,
    `in ${pose}`,
    `wearing ${eraConfig.equipment}`,
    `generic football uniform in ${uniformColors} tones plain design`,
    tierConfig.background,
    `${eraConfig.style}`,
    eraConfig.frameStyle,
    `${tierConfig.intensity} energy`,
    `card fills entire frame`,
    ANTI_TEXT_BLOCK,
  ].join(', ');
  
  return prompt;
}

/**
 * Get full position name
 */
function getPositionFullName(pos) {
  const names = {
    QB: 'quarterback',
    RB: 'running back',
    WR: 'wide receiver',
    TE: 'tight end',
    OL: 'offensive lineman',
    DL: 'defensive lineman',
    LB: 'linebacker',
    DB: 'defensive back',
    K: 'kicker',
    P: 'punter',
  };
  return names[pos] || 'football player';
}

/**
 * Get team-inspired colors (generic, no trademarked elements)
 */
function getTeamInspiredColors(team) {
  if (!team) return null;
  
  const teamColors = {
    // AFC East
    'BUF': 'royal blue and red',
    'MIA': 'aqua and orange',
    'NE': 'navy blue and silver and red',
    'NYJ': 'forest green and white',
    // AFC North
    'BAL': 'purple and black',
    'CIN': 'orange and black',
    'CLE': 'brown and orange',
    'PIT': 'black and gold',
    // AFC South
    'HOU': 'deep blue and red',
    'IND': 'royal blue and white',
    'JAX': 'teal and gold',
    'TEN': 'navy and light blue',
    // AFC West
    'DEN': 'orange and navy',
    'KC': 'red and gold',
    'LV': 'silver and black',
    'LAC': 'powder blue and gold',
    // NFC East
    'DAL': 'silver and navy and white',
    'NYG': 'royal blue and red',
    'PHI': 'midnight green and silver',
    'WAS': 'burgundy and gold',
    // NFC North
    'CHI': 'navy and orange',
    'DET': 'honolulu blue and silver',
    'GB': 'green and gold',
    'MIN': 'purple and gold',
    // NFC South
    'ATL': 'red and black',
    'CAR': 'black and blue and silver',
    'NO': 'black and gold',
    'TB': 'red and pewter',
    // NFC West
    'ARI': 'cardinal red and white',
    'LA': 'royal blue and gold',
    'SF': 'red and gold',
    'SEA': 'navy and neon green',
  };
  
  return teamColors[team] || null;
}

/**
 * Get tier configuration
 */
function getTierConfig(tier) {
  return TIER_BACKGROUNDS[tier] || TIER_BACKGROUNDS[5];
}

/**
 * Get era configuration
 */
function getEraConfig(season) {
  let era;
  if (season < 1940) era = "1920-1939";
  else if (season < 1960) era = "1940-1959";
  else if (season < 1978) era = "1960-1977";
  else if (season < 1994) era = "1978-1993";
  else if (season < 2004) era = "1994-2003";
  else if (season < 2011) era = "2004-2010";
  else if (season < 2020) era = "2011-2019";
  else era = "2020+";
  
  return ERAS[era];
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  buildPhotorealisticPrompt,
  getTierConfig,
  getEraConfig,
  getTierPose,
  ERAS,
  TIER_BACKGROUNDS,
  TIER_POSES,
  CORE_STYLE,
  ANTI_TEXT_BLOCK,
};
