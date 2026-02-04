/**
 * Environment: Testing vs Live (canonical names for all agents)
 * ============================================================
 * - testing environment = local (Next.js localhost:3000, API localhost:4000)
 * - live environment    = production (deployed frontend + backend)
 *
 * Use isTesting / isLive from this file. Do not infer from NODE_ENV or hardcoded URLs.
 */

const apiUrl =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || '')
    : process.env.NEXT_PUBLIC_API_URL || '';

const isLocalhost = (url) => {
  if (!url) return true;
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

// On the client, use actual hostname so first-and-10.vercel.app is always "live"
// even if NEXT_PUBLIC_API_URL isn't set in Vercel.
const isDeployedHost =
  typeof window !== 'undefined' &&
  window.location?.hostname &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

/** true = testing environment (local dev) */
export const isTesting =
  process.env.NEXT_PUBLIC_APP_ENV === 'development' ||
  (typeof process.env.NEXT_PUBLIC_APP_ENV === 'undefined' && !isDeployedHost && isLocalhost(apiUrl));

/** true = live environment (production, real users) */
export const isLive = !isTesting;

/** true = show Shop + wallet connect (local only; never on live) */
export const cryptoShopEnabled = isTesting;

/** Backend API base URL (for rewrites; frontend uses relative /api) */
export const apiBaseUrl = apiUrl || 'http://localhost:4000';
