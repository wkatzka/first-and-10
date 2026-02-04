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

/** true = testing environment (local dev) */
export const isTesting =
  process.env.NEXT_PUBLIC_APP_ENV === 'development' ||
  (typeof process.env.NEXT_PUBLIC_APP_ENV === 'undefined' && isLocalhost(apiUrl));

/** true = live environment (production, real users) */
export const isLive = !isTesting;

/** Backend API base URL (for rewrites; frontend uses relative /api) */
export const apiBaseUrl = apiUrl || 'http://localhost:4000';
