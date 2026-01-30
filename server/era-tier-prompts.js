/**
 * Era-based tier prompts for AI image generation.
 * Combines historical era aesthetics with tier quality levels.
 * 
 * 6 Eras × 10 Tiers = 60 unique style combinations
 */

// Era definitions with aesthetic styles - SECONDARY visual element (clearly recognizable art direction)
const ERAS = {
  "1920-1939": {
    name: "Golden Age",
    aesthetic:
      "Art deco poster illustration, ornamental corners, sunburst rays, engraved/inked linework, aged paper grain, vignette.",
  },
  "1940-1959": {
    name: "Post-War Classic",
    aesthetic:
      "Mid-century print look: screen-printed shapes, thick outlines, halftone dots, paper stock texture, simple (non-branded) badge shapes, diagram motifs.",
  },
  "1960-1979": {
    name: "Retro Era",
    aesthetic:
      "Psychedelic/wavy shapes, bold geometry, film grain, soft-focus analog feel, retro poster energy.",
  },
  "1980-1999": {
    name: "Classic Card Era",
    aesthetic:
      "Loud neon geometry, airbrushed gradients, starbursts, chrome-ish panels, lens flares, halftone/dot-matrix texture, subtle scanlines/VHS artifacts.",
  },
  "2000-2019": {
    name: "Modern Era",
    aesthetic:
      "Clean sharp angles, carbon-fiber texture, tasteful lens flare, high clarity, subtle grunge overlays.",
  },
  "2020+": {
    name: "Contemporary",
    aesthetic:
      "Ultra-clean cinematic lighting, crisp DOF, modern abstract shapes, tasteful glitch accents, premium collectible vibe.",
  },
};

// Tier quality levels - PRIMARY visual element (dominant)
const TIER_QUALITIES = {
  10: {
    name: "Legendary",
    primaryEffect:
      "VERY SPARKLY TEXTURED GOLD — Ultra-luxury gold leaf + glitter foil, deep embossed texture (micro-hammered + brushed), heavy specular highlights, star-like sparkles, bloom glow, shimmering gold dust; slight random grain/emboss variation per card.",
    visualDominance:
      "DOMINANT LAYER: the *entire card* is coated in premium textured gold foil. Gold must be the first thing you notice at a glance.",
  },
  9: {
    name: "Epic",
    primaryEffect:
      "RAINBOW OIL SHEEN — Iridescent oil-slick film with smooth color-shift bands (cyan→magenta→gold→green), pearlescent interference, prismatic refractor streaks; swirl/flow varies per card.",
    visualDominance:
      "DOMINANT LAYER: the card surface shows an obvious rainbow oil-sheen refractor effect. It must read as Tier 9 immediately.",
  },
  8: {
    name: "Ultra Rare",
    primaryEffect:
      "SHATTERED GLASS — Dramatic cracked crystal overlay, shards + spiderweb fractures, bright shard edges, internal caustics + refracted beams; shard pattern varies each mint.",
    visualDominance:
      "DOMINANT LAYER: shattered glass and refraction effects dominate the card design.",
  },
  7: {
    name: "Very Rare",
    primaryEffect:
      "LIQUID SILVER CHROME — Mirror-like molten silver (mercury) with fluid ripples, rolling highlights, strong chrome streaks; optional ultra-faint rainbow only in highlights.",
    visualDominance:
      "DOMINANT LAYER: liquid silver chrome finish is the main surface treatment.",
  },
  6: {
    name: "Rare",
    primaryEffect:
      "WORN BRONZE (LOWER-TIER) — Scuffed/oxidized bronze, uneven patina, scratches, dull hotspots, grime in corners, rubbed edges, blotchy discoloration; low sparkle, low reflectivity.",
    visualDominance:
      "DOMINANT LAYER: bronze is obvious but intentionally worn/aged. Must feel clearly weaker than Tier 7.",
  },
  5: {
    name: "Uncommon+",
    primaryEffect:
      "BRUSHED METALLIC — Satin brushed aluminum/steel grain, directional streaks, subtle reflections, light edge highlights; premium but restrained.",
    visualDominance:
      "DOMINANT LAYER: brushed metallic grain is clearly visible, but not overly shiny.",
  },
  4: {
    name: "Uncommon",
    primaryEffect:
      "DULL/ANTIQUE BRONZE — Muted bronze tint, chalky patina, low-contrast reflections; flatter/cheaper than Tier 6.",
    visualDominance:
      "DOMINANT LAYER: dull bronze tone and patina are the main finish.",
  },
  3: {
    name: "Common+",
    primaryEffect:
      "PEWTER FRAME — Simple gray pewter border, slight cast texture, minimal reflectivity; mostly matte and concentrated on the frame.",
    visualDominance:
      "DOMINANT LAYER: pewter effect is primarily visible on edges and frame areas.",
  },
  2: {
    name: "Common",
    primaryEffect:
      "BASIC FOIL ACCENT — Mostly matte print with tiny silver foil accents (thin corners/lines only).",
    visualDominance:
      "DOMINANT LAYER: mostly matte/printed look; foil is subtle and limited to small accents.",
  },
  1: {
    name: "Basic",
    primaryEffect:
      "WOOD FINISH — Natural wood grain, matte/non-reflective, slight wear/print imperfections; grain varies per card.",
    visualDominance:
      "DOMINANT LAYER: wood texture is clearly visible across the whole card (no metal).",
  },
};

/**
 * Determine which era a season falls into
 */
function getEra(season) {
  const year = parseInt(season);
  
  if (year >= 1920 && year < 1940) return "1920-1939";
  if (year >= 1940 && year < 1960) return "1940-1959";
  if (year >= 1960 && year < 1980) return "1960-1979";
  if (year >= 1980 && year < 2000) return "1980-1999";
  if (year >= 2000 && year < 2020) return "2000-2019";
  if (year >= 2020) return "2020+";
  
  // Default to modern for any edge cases
  return "2000-2019";
}

/**
 * Build a complete prompt combining era aesthetic with tier quality
 */
function buildEraBasedPrompt(player) {
  const tier = player.tier || 5;
  const era = getEra(player.season);
  
  const eraConfig = ERAS[era];
  const tierConfig = TIER_QUALITIES[tier];
  const teamColors = getTeamColors(player.team);
  const positionContext = getPositionContext(player.position);
  
  // Build the main prompt - TIER EFFECT IS PRIMARY (finish), ERA IS SECONDARY but clearly recognizable (art direction)
  const prompt = `Professional NFL trading card artwork for a ${player.position} player.

PRIMARY VISUAL - TIER ${tier} (${tierConfig.name}) FINISH:
${tierConfig.primaryEffect}
${tierConfig.visualDominance}

SECONDARY - ERA ART DIRECTION (${eraConfig.name}, ${era}):
${eraConfig.aesthetic}

Player Details:
- Dynamic ${positionContext} pose
- Team colors: ${teamColors}

CRITICAL REQUIREMENTS:
1. TIER EFFECT IS DOMINANT - the ${tierConfig.name} finish must be the most prominent visual element
2. ERA IS RECOGNIZABLE - the ${eraConfig.name} art style should be clearly visible but not overpower the tier finish
3. FULL BLEED / EDGE-TO-EDGE - artwork fills the ENTIRE image with NO borders, NO frames, NO margins
4. NO TEXT of any kind - no words, names, numbers, letters, labels, or logos
5. Trading card proportions (portrait orientation)

The image must fill edge-to-edge with no borders. A viewer should immediately recognize this as Tier ${tier} (${tierConfig.name}).`;

  return prompt;
}

/**
 * Get team colors for prompt context
 */
function getTeamColors(teamAbbr) {
  const colors = {
    ARI: "cardinal red and white",
    ATL: "red and black",
    BAL: "purple and black with gold accents",
    BUF: "royal blue and red",
    CAR: "carolina blue and black",
    CHI: "navy blue and orange",
    CIN: "orange and black with white stripes",
    CLE: "brown and orange",
    DAL: "navy blue and silver",
    DEN: "orange and navy blue",
    DET: "honolulu blue and silver",
    GB: "green and gold",
    HOU: "deep steel blue and battle red",
    IND: "royal blue and white",
    JAX: "teal and gold",
    KC: "red and gold",
    LAC: "powder blue and gold",
    LAR: "royal blue and gold",
    LV: "silver and black",
    MIA: "aqua and orange",
    MIN: "purple and gold",
    NE: "navy blue, red, and silver",
    NO: "black and gold",
    NYG: "royal blue and red",
    NYJ: "green and white",
    PHI: "midnight green and silver",
    PIT: "black and gold",
    SEA: "navy blue and neon green",
    SF: "scarlet red and gold",
    TB: "red and pewter",
    TEN: "navy blue and titan blue with red",
    WAS: "burgundy and gold",
  };
  return colors[teamAbbr] || "team colors";
}

/**
 * Get full team name from abbreviation
 */
function getFullTeamName(teamAbbr) {
  const names = {
    ARI: "Arizona Cardinals", ATL: "Atlanta Falcons", BAL: "Baltimore Ravens",
    BUF: "Buffalo Bills", CAR: "Carolina Panthers", CHI: "Chicago Bears",
    CIN: "Cincinnati Bengals", CLE: "Cleveland Browns", DAL: "Dallas Cowboys",
    DEN: "Denver Broncos", DET: "Detroit Lions", GB: "Green Bay Packers",
    HOU: "Houston Texans", IND: "Indianapolis Colts", JAX: "Jacksonville Jaguars",
    KC: "Kansas City Chiefs", LAC: "Los Angeles Chargers", LAR: "Los Angeles Rams",
    LV: "Las Vegas Raiders", MIA: "Miami Dolphins", MIN: "Minnesota Vikings",
    NE: "New England Patriots", NO: "New Orleans Saints", NYG: "New York Giants",
    NYJ: "New York Jets", PHI: "Philadelphia Eagles", PIT: "Pittsburgh Steelers",
    SEA: "Seattle Seahawks", SF: "San Francisco 49ers", TB: "Tampa Bay Buccaneers",
    TEN: "Tennessee Titans", WAS: "Washington Commanders",
  };
  return names[teamAbbr] || teamAbbr;
}

/**
 * Get position-specific pose context
 */
function getPositionContext(position) {
  const contexts = {
    QB: "quarterback throwing",
    RB: "running back rushing with ball",
    WR: "wide receiver catching",
    TE: "tight end receiving",
    OL: "offensive lineman blocking",
    OT: "offensive tackle in stance",
    OG: "offensive guard blocking",
    C: "center snapping",
    DL: "defensive lineman rushing",
    DE: "defensive end pass rushing",
    DT: "defensive tackle in action",
    LB: "linebacker tackling",
    CB: "cornerback in coverage",
    S: "safety defending",
    SS: "strong safety hitting",
    FS: "free safety intercepting",
    K: "kicker following through on kick",
    P: "punter kicking",
    LS: "long snapper",
  };
  return contexts[position] || "football action";
}

/**
 * Get a summary of the style for display purposes
 */
function getStyleSummary(player) {
  const tier = player.tier || 5;
  const era = getEra(player.season);
  const eraConfig = ERAS[era];
  const tierConfig = TIER_QUALITIES[tier];
  
  return {
    era: eraConfig.name,
    eraYears: era,
    tier: tierConfig.name,
    tierNumber: tier,
    styleSummary: `${eraConfig.name} × ${tierConfig.name}`,
  };
}

module.exports = {
  ERAS,
  TIER_QUALITIES,
  getEra,
  buildEraBasedPrompt,
  getStyleSummary,
  getTeamColors,
  getFullTeamName,
  getPositionContext,
};
