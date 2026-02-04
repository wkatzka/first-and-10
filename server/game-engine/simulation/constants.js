/**
 * Game Engine Constants & Configuration
 * ======================================
 * All tunable parameters for the simulation engine.
 */

// =============================================================================
// GAME SETTINGS
// =============================================================================

const GAME = {
  QUARTER_LENGTH: 900,        // 15 minutes in seconds
  TOTAL_QUARTERS: 4,
  PLAY_CLOCK: 40,             // Seconds per play
  MIN_PLAY_TIME: 4,           // Minimum seconds a play takes
  MAX_PLAY_TIME: 45,          // Maximum seconds (running clock)
  HALFTIME_QUARTER: 2,        // Halftime after Q2
  STARTING_FIELD_POSITION: 25, // After touchback
  YARDS_FOR_FIRST_DOWN: 10,
  YARDS_FOR_TOUCHDOWN: 100,   // Endzone at 100
};

// =============================================================================
// TIER SYSTEM
// =============================================================================

const TIERS = {
  11: { name: 'Hall of Fame', multiplier: 1.08 },  // HOF players
  10: { name: 'Legendary', multiplier: 1.00 },
  9:  { name: 'Epic',      multiplier: 0.92 },
  8:  { name: 'Ultra Rare', multiplier: 0.84 },
  7:  { name: 'Very Rare', multiplier: 0.76 },
  6:  { name: 'Rare',      multiplier: 0.68 },
  5:  { name: 'Uncommon+', multiplier: 0.60 },
  4:  { name: 'Uncommon',  multiplier: 0.52 },
  3:  { name: 'Common+',   multiplier: 0.44 },
  2:  { name: 'Common',    multiplier: 0.36 },
  1:  { name: 'Basic',     multiplier: 0.28 },
};

// Convert tier to a 0-1+ scale for probability calculations
// Supports T1-T11 (HOF) and fractional tiers via interpolation
function tierToRating(tier) {
  const t = typeof tier === 'number' ? tier : Number(tier);
  if (!Number.isFinite(t)) return 0.50;
  // Support fractional tiers by interpolating adjacent multipliers.
  // Allow tier 11 (HOF) - clamp to 1-11 range
  const clamped = Math.max(1, Math.min(11, t));
  const lo = Math.floor(clamped);
  const hi = Math.ceil(clamped);
  if (lo === hi) return TIERS[lo]?.multiplier || 0.50;
  const a = TIERS[lo]?.multiplier ?? 0.50;
  const b = TIERS[hi]?.multiplier ?? 0.50;
  const u = clamped - lo;
  return a + (b - a) * u;
}

// =============================================================================
// QB PLAYSTYLES
// =============================================================================

const QB_PLAYSTYLES = {
  PASS_HEAVY: {
    name: 'Pass Heavy',
    passFrequency: 0.68,          // Base pass play %
    wrDependency: 0.50,           // How much WR tier affects passing
    qbDependency: 0.50,           // How much QB tier affects passing
    wrSynergyBonus: 1.15,         // Bonus when WRs are T7+
    wrSynergyPenalty: 0.85,       // Penalty when WRs are T3 or below
    scrambleChance: 0.05,         // Chance to scramble when pressured
    rushContribution: 0.0,        // QB doesn't contribute to run game
  },
  DUAL_THREAT: {
    name: 'Dual Threat',
    passFrequency: 0.50,
    wrDependency: 0.35,
    qbDependency: 0.65,
    wrSynergyBonus: 1.0,          // No WR synergy bonus
    wrSynergyPenalty: 1.0,        // No WR penalty
    scrambleChance: 0.30,         // High scramble ability
    rushContribution: 0.40,       // QB adds to run game rating
  },
  BALANCED: {
    name: 'Balanced',
    passFrequency: 0.58,
    wrDependency: 0.45,
    qbDependency: 0.55,
    wrSynergyBonus: 1.08,
    wrSynergyPenalty: 0.92,
    scrambleChance: 0.12,
    rushContribution: 0.15,
  },
  GAME_MANAGER: {
    name: 'Game Manager',
    passFrequency: 0.52,
    wrDependency: 0.60,           // WRs can elevate a game manager
    qbDependency: 0.40,
    wrSynergyBonus: 1.20,         // Big bonus with good WRs
    wrSynergyPenalty: 0.90,
    scrambleChance: 0.03,
    rushContribution: 0.0,
  },
};

// =============================================================================
// POSITION IMPACT WEIGHTS
// =============================================================================

// How much each position contributes to their phase
const POSITION_WEIGHTS = {
  // Passing game
  PASS_OFFENSE: {
    QB: 0.45,   // QB is critical
    WR: 0.35,   // WRs matter a lot (combined)
    TE: 0.10,   // TE helps
    OL: 0.10,   // OL provides time
  },
  PASS_DEFENSE: {
    DB: 0.50,   // DBs are primary
    DL: 0.30,   // Pass rush matters
    LB: 0.20,   // LBs in zone/spy
  },
  
  // Run game
  RUN_OFFENSE: {
    RB: 0.45,   // RB is key
    OL: 0.45,   // OL creates holes
    TE: 0.10,   // TE blocks
  },
  RUN_DEFENSE: {
    DL: 0.40,   // DL stuffs runs
    LB: 0.40,   // LBs fill gaps
    DB: 0.20,   // DBs tackle in open field
  },
};

// =============================================================================
// PLAY OUTCOMES - BASE PROBABILITIES
// =============================================================================

const PLAY_OUTCOMES = {
  PASS: {
    // Sack chances based on OL vs DL matchup differential
    SACK_BASE: 0.07,              // 7% base sack rate
    SACK_PER_DIFF: 0.03,          // +3% per tier difference (DL winning)
    
    // Pressure (affects accuracy)
    PRESSURE_BASE: 0.25,
    PRESSURE_PER_DIFF: 0.05,
    PRESSURE_ACCURACY_PENALTY: 0.15,
    
    // Completion chances
    COMPLETION_BASE: 0.62,        // League average
    COMPLETION_PER_TIER: 0.04,    // Per tier advantage (WR vs DB)
    
    // Interception
    INT_BASE: 0.025,              // 2.5% base
    INT_PRESSURE_BONUS: 0.02,     // +2% when pressured
    INT_COVERAGE_BONUS: 0.015,    // Per tier DB > WR
    
    // Yards
    SHORT_YARDS: { min: 2, max: 8 },
    MEDIUM_YARDS: { min: 8, max: 18 },
    DEEP_YARDS: { min: 18, max: 45 },
    YAC_BASE: 3,
    YAC_PER_TIER: 1.5,
  },
  
  RUN: {
    // Tackle for loss
    TFL_BASE: 0.08,
    TFL_PER_DIFF: 0.04,           // Per tier DL/LB > OL
    
    // Base yards
    YARDS_BASE: 3.5,
    YARDS_PER_TIER: 0.8,          // Per tier RB advantage
    YARDS_OL_FACTOR: 0.6,         // Per tier OL advantage
    
    // Breakaway (big run)
    BREAKAWAY_CHANCE: 0.05,
    BREAKAWAY_YARDS: { min: 15, max: 50 },
    
    // Fumble
    FUMBLE_BASE: 0.015,
    FUMBLE_HIT_BONUS: 0.01,       // When defense wins matchup badly
  },
  
  SPECIAL_TEAMS: {
    // Field goals by distance
    FG_BASE_ACCURACY: {
      '0-19': 0.98,
      '20-29': 0.95,
      '30-39': 0.88,
      '40-49': 0.78,
      '50+': 0.62,
    },
    FG_TIER_BONUS: 0.02,          // Per tier above 5
    
    // Punting
    PUNT_DISTANCE_BASE: 42,
    PUNT_DISTANCE_PER_TIER: 3,
    
    // Kickoffs
    TOUCHBACK_CHANCE: 0.60,
    RETURN_YARDS_BASE: 22,
  },
};

// =============================================================================
// SITUATIONAL MODIFIERS
// =============================================================================

const SITUATION = {
  // Red zone (inside 20)
  RED_ZONE: {
    passFrequencyMod: -0.05,      // Slightly more runs
    teValueBonus: 1.3,            // TE more valuable
    deepPassPenalty: 0.5,         // Less room for deep shots
  },
  
  // Goal line (inside 5)
  GOAL_LINE: {
    passFrequencyMod: -0.15,      // Much more runs
    rbValueBonus: 1.3,
    qbSneakChance: 0.15,          // QB sneak option
  },
  
  // Third down
  THIRD_DOWN: {
    shortYardage: 3,              // 3 or fewer yards = short
    shortPassFrequency: 0.45,     // More balanced on 3rd & short
    longPassFrequency: 0.80,      // Heavy pass on 3rd & long
    conversionBonus: 0.05,        // Tier bonus more impactful
  },
  
  // Two-minute drill
  TWO_MINUTE: {
    passFrequencyMod: 0.20,       // Pass heavy
    playClockUsage: 'fast',       // Spike, hurry up
    timePerPlay: 8,               // Faster plays
  },
  
  // Protecting lead (4th quarter, up by 1-8)
  PROTECT_LEAD: {
    passFrequencyMod: -0.15,
    playClockUsage: 'slow',
    timePerPlay: 40,              // Run clock
  },
  
  // Comeback mode (down by 9+, 4th quarter)
  COMEBACK: {
    passFrequencyMod: 0.25,
    playClockUsage: 'fast',
    riskTolerance: 1.3,           // More aggressive
  },
};

// =============================================================================
// SCORING
// =============================================================================

const SCORING = {
  TOUCHDOWN: 6,
  EXTRA_POINT: 1,
  TWO_POINT: 2,
  FIELD_GOAL: 3,
  SAFETY: 2,
  
  // Extra point / 2pt conversion rates
  EXTRA_POINT_SUCCESS: 0.94,
  TWO_POINT_SUCCESS_BASE: 0.48,
  TWO_POINT_TIER_BONUS: 0.03,
};

// =============================================================================
// OFFENSIVE / DEFENSIVE STRATEGY (rock-paper-scissors)
// =============================================================================
// Offense: Pass Heavy, Balanced, Run Dominant
// Defense: Coverage Shell (Nickel/Dime), Run Stuff (Stacked Box), Base (4-3/3-4)
// Matchup table: each defense "Beats" one offense type and "Loses To" another.

const OFFENSIVE_STRATEGIES = {
  pass_heavy:   { name: 'Pass Heavy',   label: 'Pass Heavy' },
  balanced:     { name: 'Balanced',     label: 'Balanced' },
  run_dominant: { name: 'Run Dominant', label: 'Run Dominant' },
};

const DEFENSIVE_STRATEGIES = {
  coverage_shell: { name: 'Coverage Shell (Nickel/Dime)', beats: 'pass_heavy',   losesTo: 'run_dominant' },
  run_stuff:      { name: 'Run Stuff (Stacked Box)',      beats: 'run_dominant', losesTo: 'balanced' },
  base_defense:   { name: 'Base Defense (4-3/3-4)',       beats: 'balanced',     losesTo: 'pass_heavy' },
};

// Strategy matchup modifier for play outcomes (legacy, kept for reference)
// Now using player-level rating boosts instead (see STRATEGY_RATING_BOOSTS below)
const STRATEGY_MATCHUP_MODIFIERS = {
  coverage_shell: {
    pass_heavy:   { pass: 1.00, run: 1.00 }, // handled by rating boosts now
    balanced:     { pass: 1.00, run: 1.00 },
    run_dominant: { pass: 1.00, run: 1.00 },
  },
  run_stuff: {
    pass_heavy:   { pass: 1.00, run: 1.00 },
    balanced:     { pass: 1.00, run: 1.00 },
    run_dominant: { pass: 1.00, run: 1.00 },
  },
  base_defense: {
    pass_heavy:   { pass: 1.00, run: 1.00 },
    balanced:     { pass: 1.00, run: 1.00 },
    run_dominant: { pass: 1.00, run: 1.00 },
  },
};

// =============================================================================
// PLAYER-LEVEL STRATEGY BOOSTS
// =============================================================================
// Rating multipliers applied to specific positions based on strategy matchup.
// ~5% boost/nerf gives ~10 pp win rate swing (advantage vs captured).
// 
// Results: advantage, captured, or neutral
// - advantage: your offense beats their defense type (or your defense beats their offense)
// - captured: their defense beats your offense type (or their offense beats your defense)
// - neutral: no rock-paper-scissors edge either way

const STRATEGY_BOOST_AMOUNT = 0.007; // 0.7% tier multiplier (tuned for ~10 pp swing on double advantage)

// Offensive strategy vs opponent's defensive strategy
// Returns which positions on OFFENSE get boosted/nerfed
const OFFENSE_STRATEGY_BOOSTS = {
  pass_heavy: {
    base_defense:    'advantage',   // base loses to pass_heavy
    coverage_shell:  'captured',    // coverage beats pass_heavy
    run_stuff:       'neutral',
  },
  balanced: {
    run_stuff:       'advantage',   // run_stuff loses to balanced
    base_defense:    'captured',    // base beats balanced
    coverage_shell:  'neutral',
  },
  run_dominant: {
    coverage_shell:  'advantage',   // coverage loses to run
    run_stuff:       'captured',    // run_stuff beats run
    base_defense:    'neutral',
  },
};

// Defensive strategy vs opponent's offensive strategy
// Returns which positions on DEFENSE get boosted/nerfed
const DEFENSE_STRATEGY_BOOSTS = {
  coverage_shell: {
    pass_heavy:   'advantage',      // coverage beats pass
    run_dominant: 'captured',       // run beats coverage
    balanced:     'neutral',
  },
  run_stuff: {
    run_dominant: 'advantage',      // run_stuff beats run
    balanced:     'captured',       // balanced beats run_stuff
    pass_heavy:   'neutral',
  },
  base_defense: {
    balanced:     'advantage',      // base beats balanced
    pass_heavy:   'captured',       // pass beats base
    run_dominant: 'neutral',
  },
};

// Which positions are affected by each strategy type
const STRATEGY_AFFECTED_POSITIONS = {
  // Offensive strategies affect these offensive positions
  offense: {
    pass_heavy:   ['QB', 'WR', 'TE'],       // passing game positions
    balanced:     ['QB', 'WR', 'RB', 'OL'], // all skill positions
    run_dominant: ['RB', 'OL', 'TE'],       // run game positions
  },
  // Defensive strategies affect these defensive positions
  defense: {
    coverage_shell: ['DB'],                 // secondary
    run_stuff:      ['DL', 'LB'],           // front seven
    base_defense:   ['DL', 'LB', 'DB'],     // all defensive positions
  },
};

// =============================================================================
// DRIVE OUTCOMES
// =============================================================================

const DRIVE = {
  // 4th down decisions
  GO_FOR_IT_THRESHOLD: {
    ownTerritory: 0.15,           // Rarely go for it in own territory
    midfield: 0.35,               // Sometimes at midfield
    opponent40: 0.50,             // More aggressive past midfield
    opponent30: 0.25,             // Usually kick FG
    opponent10: 0.60,             // TD or bust in red zone
    opponent5: 0.75,              // Almost always go for it at goal line
  },
  
  // Yards threshold for decision
  SHORT_YARDAGE: 2,               // Go for it if 2 or fewer yards
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  GAME,
  TIERS,
  tierToRating,
  QB_PLAYSTYLES,
  POSITION_WEIGHTS,
  PLAY_OUTCOMES,
  SITUATION,
  SCORING,
  DRIVE,
  OFFENSIVE_STRATEGIES,
  DEFENSIVE_STRATEGIES,
  STRATEGY_MATCHUP_MODIFIERS,
  // Player-level strategy boosts
  STRATEGY_BOOST_AMOUNT,
  OFFENSE_STRATEGY_BOOSTS,
  DEFENSE_STRATEGY_BOOSTS,
  STRATEGY_AFFECTED_POSITIONS,
};
