/**
 * Image Regeneration Queue (rate-limited)
 * ======================================
 * Prevents bursts of OpenAI image calls by queuing work and enforcing
 * a minimum delay between attempts. Deduplicates jobs per card id.
 */
 
let started = false;
let timer = null;

const queue = [];
const queuedIds = new Set();
const inFlightIds = new Set();

let nextAllowedAt = 0;
let processing = false;

function defaultMinIntervalMs() {
  const raw = process.env.AI_IMAGE_MIN_INTERVAL_MS;
  const ms = raw ? parseInt(raw, 10) : 15000; // ~4/min (below 5/min limit)
  return Number.isFinite(ms) && ms > 0 ? ms : 15000;
}

function computeBackoffMs(attempts, minIntervalMs) {
  // Exponential backoff capped at 10 minutes
  const base = Math.max(minIntervalMs, 15000);
  const backoff = base * Math.pow(2, Math.max(0, attempts));
  return Math.min(backoff, 10 * 60 * 1000);
}

function normalizeCardForAi(card) {
  return {
    player: card.player_name || card.player || 'Unknown',
    player_name: card.player_name || card.player || 'Unknown',
    season: card.season,
    team: card.team,
    position: card.position,
    tier: card.tier,
    composite_score: card.composite_score,
    ...card,
  };
}

function isRateLimitError(err) {
  const msg = (err && err.message ? String(err.message) : '').toLowerCase();
  return msg.includes('rate limit') || msg.includes('429');
}

function enqueue(cardId, card, reason = 'unknown') {
  if (!cardId || !card) return false;
  if (queuedIds.has(cardId) || inFlightIds.has(cardId)) return false;
  queuedIds.add(cardId);
  queue.push({
    cardId,
    card,
    attempts: 0,
    nextAttemptAt: Date.now(),
    reason,
  });
  return true;
}

async function processOne({ db, cardImageGenerator, minIntervalMs }) {
  const now = Date.now();
  if (processing) return;
  if (now < nextAllowedAt) return;

  // Find next due job
  const idx = queue.findIndex(j => j.nextAttemptAt <= now);
  if (idx === -1) return;

  const job = queue.splice(idx, 1)[0];
  queuedIds.delete(job.cardId);
  inFlightIds.add(job.cardId);
  processing = true;

  // Enforce spacing between attempts (even failures)
  nextAllowedAt = now + minIntervalMs;

  try {
    const playerData = normalizeCardForAi(job.card);
    const imageUrl = await cardImageGenerator.generateAICard(playerData);

    // Only accept PNG results; SVG/placeholder means AI didn't actually succeed.
    if (imageUrl && imageUrl.endsWith('.png')) {
      db.updateCardImage(job.cardId, imageUrl);
      // success
      return;
    }

    // Treat non-png as failure; schedule retry
    job.attempts += 1;
    job.nextAttemptAt = Date.now() + computeBackoffMs(job.attempts, minIntervalMs);
    // requeue same job with updated attempts
    queuedIds.add(job.cardId);
    queue.push(job);
  } catch (err) {
    // Retry with backoff (rate limit gets larger backoff)
    const rateLimited = isRateLimitError(err);
    job.attempts += 1;
    const backoff = computeBackoffMs(job.attempts + (rateLimited ? 2 : 0), minIntervalMs);
    job.nextAttemptAt = Date.now() + backoff;
    job.reason = rateLimited ? 'rate_limited' : 'error';
    queuedIds.add(job.cardId);
    queue.push(job);
  } finally {
    inFlightIds.delete(job.cardId);
    processing = false;
  }
}

function start({ db, cardImageGenerator }) {
  if (started) return;
  started = true;
  const minIntervalMs = defaultMinIntervalMs();

  // Light, steady tick; actual rate controlled by nextAllowedAt
  timer = setInterval(() => {
    processOne({ db, cardImageGenerator, minIntervalMs }).catch(() => {});
  }, 1000);
}

function getStats() {
  return {
    queued: queue.length,
    queuedIds: queuedIds.size,
    inFlight: inFlightIds.size,
    nextAllowedInMs: Math.max(0, nextAllowedAt - Date.now()),
    minIntervalMs: defaultMinIntervalMs(),
  };
}

module.exports = {
  start,
  enqueue,
  getStats,
};

