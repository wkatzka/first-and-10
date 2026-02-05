# Strategy System Nuance Options

## Current System (as of Feb 2026)

The current system is binary:
1. **Strategy derived** from roster composition (passRating vs runRating)
2. **Matchup result**: advantage / captured / neutral
3. **Uniform boost**: All affected positions get same ±0.7% tier modifier

### Limitation
A user who builds a hybrid roster (e.g., one elite WR + better RBs) derives "balanced" strategy. All WRs get the same boost/nerf regardless of individual tier.

---

## Option A: Scaled Boosts by Player Tier

Boost scales with how good the individual player is relative to position average.

**Formula:**
```
playerBoost = baseBoost * (playerTier / avgPositionTier)
```

**Example:**
- Team has WRs: T10, T5, T5 (avg = 6.67)
- Base boost = +0.7%
- T10 WR boost = 0.7% * (10/6.67) = +1.05%
- T5 WR boost = 0.7% * (5/6.67) = +0.52%

**Pros:**
- Elite players benefit more from favorable matchups
- Rewards investing in star players

**Cons:**
- More complex to understand
- Could widen gap between whale and F2P rosters

---

## Option B: Continuous Strategy Spectrum

Instead of discrete categories (pass_heavy/balanced/run_dominant), calculate a continuous score.

**Implementation:**
```js
// 0 = pure run, 0.5 = balanced, 1 = pure pass
const passWeight = passRating / (passRating + runRating);

// Boost scales with commitment
const effectiveBoost = baseBoost * Math.abs(passWeight - 0.5) * 2;
```

**Example:**
- Team with passWeight = 0.8 (very pass-heavy) gets full boost
- Team with passWeight = 0.6 (slight pass lean) gets 40% of boost

**Pros:**
- Rewards roster commitment to a style
- More realistic (real NFL teams have tendencies, not binary styles)

**Cons:**
- Harder to explain to users
- "In-between" rosters might feel unrewarding

---

## Option C: User-Selected Strategy (Override)

Let users explicitly declare their strategy, independent of roster composition.

**How it works:**
1. User selects "Pass Heavy" even if roster is balanced
2. Strategy determines matchup (rock-paper-scissors)
3. Boost effectiveness scales with roster support

**Formula:**
```js
// User declares pass_heavy
const declaredStrategy = 'pass_heavy';

// Roster support = how well roster fits declared strategy
const rosterSupport = calculateRosterFit(roster, declaredStrategy);
// Returns 0.5 - 1.5 based on QB/WR quality for pass_heavy

// Actual boost = base * support
const actualBoost = baseBoost * rosterSupport;
```

**Example:**
- User declares "Pass Heavy" with T10 QB, T10 WRs → rosterSupport = 1.3 → +0.91% boost
- User declares "Pass Heavy" with T5 QB, T5 WRs → rosterSupport = 0.7 → +0.49% boost

**Pros:**
- Adds strategic decision-making (declare vs. actual talent)
- Users control the rock-paper-scissors game
- Can bluff or play mind games

**Cons:**
- Adds UI complexity (strategy selector)
- Could feel punishing if you "misread" opponent

---

## Option D: Position-Specific Matchups

Each player matchup is evaluated individually rather than team-wide.

**How it works:**
- Your WR1 (T10) vs their CB1 (T6) = strong advantage
- Your WR2 (T5) vs their CB2 (T8) = disadvantage
- Net effect calculated per position battle

**Implementation:**
```js
function calculatePositionMatchup(offPlayer, defPlayer, strategyContext) {
  const tierDiff = offPlayer.tier - defPlayer.tier;
  const strategyMod = getStrategyModifier(strategyContext); // ±5%
  
  return {
    advantage: tierDiff + (tierDiff * strategyMod),
    // Use this in play simulation
  };
}
```

**Pros:**
- Most realistic (NFL is won in individual matchups)
- Rewards smart roster construction (exploit weak CBs)

**Cons:**
- Complex to implement and explain
- Might diminish team-level strategy importance

---

## Recommendation

**Start with Option C (User-Selected Strategy)** because:
1. Adds meaningful decision without over-complicating
2. Creates pre-game mind games ("will they go pass or run?")
3. Roster quality still matters (support multiplier)
4. Easy to explain: "Pick your style, but you need the players to back it up"

Can layer in Option A (scaled by player tier) later for additional depth.

---

## Related Files
- `/server/game-engine/simulation/constants.js` - STRATEGY_BOOST_AMOUNT, matchup tables
- `/server/game-engine/simulation/playstyle.js` - strategy derivation, boost functions
- `/server/game-engine/simulation/game.js` - applyRosterBoosts, createGameState
