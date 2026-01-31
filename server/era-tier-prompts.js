/**
 * Era-Tier Photorealistic Prompt System
 * ======================================
 * Generates DALL-E prompts for NFL trading cards with:
 * - Era-specific equipment and visual styles
 * - Position-specific poses
 * - Tier-specific backgrounds
 */

// =============================================================================
// CORE PHOTOREALISM RULES
// =============================================================================

const CORE_RULES = `Photorealistic, cinematic sports photography, studio-lit portrait, male American football player, athletic build, intense expression, trading card format, subject fills entire frame edge-to-edge, no text, no logos, no NFL branding, no team names, shot on medium format camera, shallow depth of field, 85mm lens, dramatic rim lighting, high production value, commercial photography quality`;

// =============================================================================
// ERA-SPECIFIC EQUIPMENT & STYLING
// =============================================================================

const ERAS = {
  "1920-1939": {
    name: "Leather Era",
    equipment: "soft leather helmet with no facemask, exposed face, canvas or wool jersey with horizontal stripes, minimal padding, broad shoulders visible through jersey, high-waisted canvas pants with belt, high-top leather cleats",
    style: "sepia-tinted photography with warm golden highlights, Art Deco geometric patterns, sunburst rays, stepped forms, gold leaf accents",
    palette: "gold, black, cream, burgundy, bronze",
  },
  "1940-1959": {
    name: "Post-War Era",
    equipment: "early plastic shell helmet, single-bar facemask or no mask, thick wool jersey with felt numbers, bulky leather shoulder pads visible under jersey, high-top black leather cleats",
    style: "propaganda poster aesthetic, bold saturated colors, pin-up art influence, heroic poses, military stencil influence, riveted metal textures",
    palette: "army green, navy blue, rust red, cream, sepia",
  },
  "1960-1977": {
    name: "Psychedelic Era",
    equipment: "Riddell-style suspension helmet, two-bar facemask, fitted polyester jersey with screen-printed numbers, longer hair visible below helmet, lower-cut cleats, white tape on ankles",
    style: "psychedelic swirls, tie-dye patterns, lava lamp fluidity, organic flowing shapes, wavy distortion effects, Woodstock energy, peace era optimism",
    palette: "burnt orange, avocado green, mustard yellow, deep purple, brown",
  },
  "1978-1993": {
    name: "Synthwave Era",
    equipment: "full-cage facemask, polycarbonate helmet shell, tinted visor Oakley style, massive shoulder pads, eye black, wristbands, towel hanging from waist, mesh jersey tight-fitting",
    style: "hair metal chrome, Tron grid lines, Miami Vice gradients, neon tube lighting, laser effects, smoke machines, excessive over-the-top aggressive",
    palette: "hot pink, electric cyan, neon green, chrome silver, black",
  },
  "1994-2003": {
    name: "Y2K Era",
    equipment: "Riddell Revolution helmet, streamlined shell, carbon fiber facemask, form-fitting jersey with stretch fabric, integrated pads, sleeker silhouette",
    style: "Matrix digital rain, tribal tattoo patterns, liquid chrome surfaces, morphing metal, early CGI aesthetic, chrome bubble effects",
    palette: "silver, electric blue, lime green, black, brushed metal",
  },
  "2004-2010": {
    name: "Millennium Era",
    equipment: "Riddell Revolution style helmet, custom visor, form-fitting jersey, modern shoulder pads, visible undershirt at collar",
    style: "clean minimalism, premium material feel, gradient meshes, social media aesthetic, flat design with subtle depth",
    palette: "premium black, subtle gradients, accent neons, white, silver",
  },
  "2011-2019": {
    name: "High Tech Era",
    equipment: "Speedflex or Vicis-style helmet matte finish, compression undershirt visible at collar, Nike or Under Armour style jersey with moisture-wicking texture, custom visor with anti-glare coating",
    style: "clean minimalism, app-inspired UI elements, gradient meshes, premium material feel, social media aesthetic, flat design with subtle depth",
    palette: "premium black, subtle gradients, accent neons, white",
  },
  "2020+": {
    name: "Hypermodern Era",
    equipment: "cutting-edge helmet with integrated sensors, futuristic vents, iridescent visor, seamless jersey construction, engineered mesh zones, next-gen cleats with carbon fiber plates",
    style: "holographic overlays, AR/VR elements, glitch effects, volumetric lighting, NFT visual language, digital artifacts",
    palette: "iridescent shifting colors, void black, electric accents",
  },
};

// =============================================================================
// POSITION-SPECIFIC POSES
// =============================================================================

const POSITION_POSES = {
  QB: "quarterback in mid-throw motion, arm cocked back, football gripped at ear level, eyes scanning downfield, athletic throwing stance, weight transferring from back foot to front foot",
  RB: "running back with stiff arm extended, football tucked against chest, explosive cutting motion, low center of gravity, powerful leg drive, churning legs",
  WR: "wide receiver leaping with arms fully extended overhead, fingertips reaching for spectacular catch, body stretched in athletic extension, eyes locked on incoming ball",
  TE: "tight end catching football over the middle, strong hands securing ball against body, muscular build, bracing for contact, shoulders squared",
  OL: "offensive lineman in pass protection stance, hands up ready to engage, wide base, massive powerful build, anchored blocking position, knees bent",
  DL: "defensive end exploding off the edge in pass rush, arm extended in swim move, low pad level, explosive athletic stance, bent at waist",
  LB: "linebacker in explosive tackling form, arms wrapping for tackle, athletic muscular build, attacking downhill, intense expression",
  DB: "cornerback leaping for interception, high-pointing the football, athletic body control in air, eyes locked on ball, lean quick build",
  K: "kicker in follow-through position, leg fully extended upward, plant foot grounded, arms out for balance, eyes following ball flight",
  P: "punter mid-kick, leg swinging through full extension, ball just leaving foot, arm extended for balance",
};

// =============================================================================
// TIER-SPECIFIC BACKGROUNDS
// =============================================================================

const TIER_BACKGROUNDS = {
  11: {
    name: "Hall of Fame",
    background: "standing before massive deep space observatory backdrop, Hubble telescope nebula image behind, cosmic purple and blue rim lighting, distant galaxies visible, supernova explosion in background, swirling cosmic clouds",
    lighting: "cosmic blue and purple rim lighting, ethereal glow",
    intensity: "transcendent, legendary, cosmic, eternal",
  },
  10: {
    name: "Legendary",
    background: "stadium fireworks exploding behind, night sky filled with pyrotechnics, sparks and embers falling around player, firework light trails",
    lighting: "face lit by warm firework glow, dramatic rim lighting from explosions",
    intensity: "explosive, triumphant, celebratory, powerful",
  },
  9: {
    name: "Epic",
    background: "standing before wall of iridescent holographic panels, oil-on-water rainbow patterns swirling, soap bubble macro textures, prismatic light refracting, abalone shell iridescence, shifting colors from pink to cyan to gold",
    lighting: "prismatic rainbow light refracting across player, iridescent rim lighting",
    intensity: "spectacular, otherworldly, mesmerizing",
  },
  8: {
    name: "Ultra Rare",
    background: "violent thunderstorm backdrop, multiple lightning bolts forking across dramatic storm clouds, rain-soaked jersey, flash-frozen rain droplets suspended in air",
    lighting: "dramatic studio flash mixed with natural lightning, storm illumination",
    intensity: "powerful, electric, dramatic, raw",
  },
  7: {
    name: "Very Rare",
    background: "surrounded by explosion of gold flakes and gold dust particles suspended in air, stacked gold bullion and gold nuggets visible, pyrite crystal formations, geometric gold patterns",
    lighting: "warm tungsten studio lights, golden spotlight, rich amber glow",
    intensity: "prestigious, valuable, gleaming",
  },
  6: {
    name: "Rare",
    background: "breaking through massive glass panel, high-speed photography capturing tempered glass fragments suspended mid-shatter, light refracting through flying shards, breakaway moment",
    lighting: "dramatic studio lighting catching reflections in glass shards",
    intensity: "explosive, dynamic, breakthrough",
  },
  5: {
    name: "Uncommon+",
    background: "polished chrome circuit board sculpture backdrop, reflective chrome surfaces with etched circuit patterns, LED trace lighting embedded in chrome panels, mirror-finish metal creating infinite reflections",
    lighting: "cool blue accent lighting, chrome reflections",
    intensity: "technical, modern, sleek",
  },
  4: {
    name: "Uncommon",
    background: "brushed stainless steel backdrop, industrial metal panels, visible brush grain pattern, welded steel seams, factory aesthetic",
    lighting: "cool neutral studio lighting",
    intensity: "solid, industrial, dependable",
  },
  3: {
    name: "Common+",
    background: "brushed bronze metal backdrop with subtle oxidation patina, matte bronze finish, not highly reflective, aged metal texture",
    lighting: "warm amber fill lighting",
    intensity: "warm, simple, honest",
  },
  2: {
    name: "Common",
    background: "matte painted seamless backdrop, solid neutral color background, professional studio setup, no texture or pattern",
    lighting: "soft even studio lighting",
    intensity: "clean, simple, unremarkable",
  },
  1: {
    name: "Basic",
    background: "plain wooden backdrop, raw plywood panels, visible wood grain, unfinished lumber, utilitarian warehouse setting",
    lighting: "basic overhead lighting like a warehouse",
    intensity: "plain, basic, simple",
  },
};

// =============================================================================
// PROMPT BUILDER
// =============================================================================

/**
 * Build a complete photorealistic DALL-E prompt
 * @param {Object} card - Card data with player, position, tier, season/era
 * @returns {string} - Complete DALL-E prompt
 */
function buildPhotorealisticPrompt(card) {
  const position = card.position || card.pos_group || 'QB';
  const tier = card.tier || 5;
  const season = card.season || 2020;
  
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
  const pose = POSITION_POSES[position] || POSITION_POSES.QB;
  
  // Build the prompt
  const prompt = `${CORE_RULES}, ${pose}, wearing ${eraConfig.equipment}, ${tierConfig.background}, ${tierConfig.lighting}, ${eraConfig.style}, color palette of ${eraConfig.palette}, ${tierConfig.intensity} energy, trading card fills entire frame edge to edge`;
  
  return prompt;
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
  ERAS,
  TIER_BACKGROUNDS,
  POSITION_POSES,
  CORE_RULES,
};
