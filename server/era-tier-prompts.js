/**
 * Era-based tier prompts for AI image generation.
 * Combines historical era aesthetics with tier quality levels.
 * 
 * 6 Eras × 10 Tiers = 60 unique style combinations
 */

// Era definitions with aesthetic styles - SECONDARY visual element (subtle influence)
const ERAS = {
  "1920-1939": {
    name: "Golden Age",
    aesthetic:
      "Art deco poster illustration vibe. Ornamental corner flourishes, sunburst rays, engraved/inked linework, aged paper grain, slight vignette. Feels like a 1920s/30s illustrated program cover.",
    colorInfluence:
      "Sepia + cream base with muted black ink lines; occasional vintage orange/navy accents; paper aging, foxing, and light stains.",
  },
  "1940-1959": {
    name: "Post-War Classic",
    aesthetic:
      "Mid‑century print/illustration look. Screen-printed shapes, thick outlines, halftone dots, paper stock texture, simple badge shapes (non-branded), classic scoreboard/diagram motifs.",
    colorInfluence:
      "Warm off-white paper with bold primary accents; slightly faded inks; subtle halftone and misregistration.",
  },
  "1960-1979": {
    name: "Retro Era",
    aesthetic:
      "60s/70s retro graphic design. Wavy shapes, thick geometric frames, psychedelic poster energy, film grain, slightly soft focus photography/illustration blend.",
    colorInfluence:
      "Earth tones + harvest gold + avocado green + burnt orange; slightly faded with analog noise.",
  },
  "1980-1999": {
    name: "Classic Card Era",
    aesthetic:
      "80s/90s trading-card vibe: loud geometry, neon stripes, airbrushed gradients, starbursts, chrome-ish graphic panels, bold framing, lens flares, dot-matrix/halftone textures, analog scanlines. Should feel unmistakably 1980s/early-90s.",
    colorInfluence:
      "Hot neon accents (cyan/magenta/yellow) with bold team colors; high-contrast glow; subtle VHS/scanline artifacts.",
  },
  "2000-2019": {
    name: "Modern Era",
    aesthetic:
      "2000s/2010s modern sports design: clean layouts, sharp angles, carbon-fiber textures, tasteful lens flares, high-clarity digital look, subtle grunge overlays.",
    colorInfluence:
      "Neutral darks with crisp highlights; tasteful metallic accents; modern UI-like panels (no text).",
  },
  "2020+": {
    name: "Contemporary",
    aesthetic:
      "2020s premium digital art: ultra-clean rendering, cinematic lighting, crisp depth-of-field, modern abstract shapes, tasteful glitch accents, high-end collectible vibe (without logos/text).",
    colorInfluence:
      "Contemporary palette with controlled neon pops; clean blacks; modern gradients; subtle glitch noise.",
  },
};

// Tier quality levels - PRIMARY visual element (dominant)
const TIER_QUALITIES = {
  10: {
    name: "Legendary",
    primaryEffect:
      "VERY SPARKLY TEXTURED GOLD FOIL — ultra-luxury gold leaf + glitter foil. Deep embossed texture (micro-hammered + brushed), heavy specular highlights, star-like sparkles, radiant bloom glow, and shimmering gold dust. Add subtle random variation in the gold grain/emboss pattern so Tier 10 cards look slightly different from each other while staying unmistakably gold.",
    visualDominance:
      "DOMINANT LAYER: the *entire card* is coated in premium textured gold foil. Gold must be the first thing you notice at a glance (not the era).",
  },
  9: {
    name: "Epic",
    primaryEffect:
      "RAINBOW OIL SHEEN REFRACTOR — iridescent oil-slick film with smooth color-shift bands (cyan→magenta→gold→green), pearlescent interference patterns, and prismatic refractor streaks. Looks like rainbow gasoline sheen on water but as premium card foil. Subtle swirls/flow lines should vary per card.",
    visualDominance:
      "DOMINANT LAYER: the card surface shows an obvious rainbow oil-sheen refractor across the frame/background. It must read as Tier 9 immediately.",
  },
  8: {
    name: "Ultra Rare",
    primaryEffect:
      "SHATTERED GLASS PRISM — dramatic cracked crystal with sharp shards, spiderweb fractures, and refracted light beams. Bright highlights on shard edges, internal caustics, and a sense of depth like broken tempered glass over the card. Shard pattern should be different each time.",
    visualDominance:
      "DOMINANT LAYER: shattered glass and refraction effects dominate the card design. Viewers should instantly think 'Tier 8 = glass shatter.'",
  },
  7: {
    name: "Very Rare",
    primaryEffect:
      "LIQUID SILVER CHROME — mirror-like molten silver with fluid ripples and rolling highlights, like mercury metal. High reflectivity, bright chrome specular streaks, subtle depth waves. (Optional: extremely faint rainbow undertone only in highlights, but it should still read mostly silver.)",
    visualDominance:
      "DOMINANT LAYER: liquid silver chrome finish is the main surface treatment (not bronze, not gold, not rainbow).",
  },
  6: {
    name: "Rare",
    primaryEffect:
      "WORN BRONZE (LOWER-TIER) — scuffed and oxidized bronze with uneven patina, scratches, dull hotspots, grime in corners, rubbed edges, and blotchy discoloration. Reads as bronze but clearly *imperfect* and used, with low sparkle and low reflectivity.",
    visualDominance:
      "DOMINANT LAYER: bronze is obvious but intentionally worn/aged. Must feel clearly weaker than Tier 7 (liquid silver) and weaker than any shiny/high-gloss tier.",
  },
  5: {
    name: "Uncommon+",
    primaryEffect:
      "BRUSHED METALLIC (ALUMINUM/STEEL) — clean brushed metal grain with directional streaks, subtle satin reflections, light edge highlights. Premium but restrained. Not rainbow, not gold, not chrome—just tasteful brushed metal texture.",
    visualDominance:
      "DOMINANT LAYER: brushed metallic grain is clearly visible across frame/panels, but not overly shiny.",
  },
  4: {
    name: "Uncommon",
    primaryEffect:
      "DULL BRONZE / ANTIQUE BRONZE — muted bronze tint with minimal sheen, slightly chalky patina, soft low-contrast reflections. Reads as bronze-adjacent but flatter/cheaper than Tier 6.",
    visualDominance:
      "DOMINANT LAYER: dull bronze tone and patina are the main finish, clearly lower-impact than Tier 6.",
  },
  3: {
    name: "Common+",
    primaryEffect:
      "PEWTER FRAME — simple gray pewter border with light metallic edge highlights. Slight texture like cast pewter, minimal reflectivity. Mostly matte with a hint of metal on the frame only.",
    visualDominance:
      "DOMINANT LAYER: pewter effect is primarily on the border/frame, not the whole card.",
  },
  2: {
    name: "Common",
    primaryEffect:
      "BASIC FOIL ACCENT — very small, simple silver foil accents (thin lines or corners only). Minimal shine, mostly flat print with a couple metallic touches.",
    visualDominance:
      "DOMINANT LAYER: mostly matte/printed look; foil is subtle and limited to small accents.",
  },
  1: {
    name: "Basic",
    primaryEffect:
      "WOOD FINISH — natural wood grain texture (oak/maple vibe), matte non-reflective surface, slight wear/print imperfections. Looks like a cheap novelty wooden card. Wood grain should vary per card.",
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
  
  // Build the main prompt - TIER EFFECT IS PRIMARY (finish), ERA IS SECONDARY but SALIENT (art direction/layout)
  const prompt = `Professional NFL trading card artwork for a ${player.position} player in ${player.team} uniform.

PRIMARY VISUAL (TIER ${tier} - ${tierConfig.name}):
${tierConfig.primaryEffect}
${tierConfig.visualDominance}

ERA ART DIRECTION (${eraConfig.name} Era - ${era}) — must be clearly recognizable:
${eraConfig.aesthetic}
Color/print influence: ${eraConfig.colorInfluence}

Player Details:
- Dynamic ${positionContext} pose
- Team colors: ${teamColors}
- Era: ${era}

CRITICAL REQUIREMENTS:
1. THE TIER ${tier} EFFECT (${tierConfig.primaryEffect}) MUST BE THE DOMINANT VISUAL - this is the most important element
2. The era must be clearly recognizable via layout/illustration/printing artifacts, but it must NOT overpower the tier finish/material
3. NO TEXT, NO WORDS, NO NAMES, NO NUMBERS on the card
4. Trading card proportions (2.5:3.5 ratio, portrait orientation)
5. Professional sports card design

The tier effect must be immediately recognizable - a viewer should be able to identify this as Tier ${tier} (${tierConfig.name}) at first glance.

Do NOT include any text, words, names, numbers, letters, typography, labels, badges, watermarks, or logos. Avoid NFL shields or any recognizable team marks. Create original artistic interpretations.`;

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
