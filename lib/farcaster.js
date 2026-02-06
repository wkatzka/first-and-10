/**
 * Farcaster Mini App detection and SDK utilities.
 * Detects if the app is running inside Warpcast and provides SDK access.
 */

// Check if we're running inside a Farcaster Mini App context
export function isFarcasterMiniApp() {
  if (typeof window === 'undefined') return false;
  
  // Check for Farcaster-specific indicators
  const url = new URL(window.location.href);
  
  // Method 1: Check for miniApp query param (recommended by Farcaster docs)
  if (url.searchParams.get('miniApp') === 'true') return true;
  
  // Method 2: Check for /miniapp path prefix
  if (url.pathname.startsWith('/miniapp')) return true;
  
  // Method 3: Check for Farcaster user agent or embedded context
  // Warpcast embeds apps in a webview with specific characteristics
  if (typeof window.ReactNativeWebView !== 'undefined') return true;
  
  // Method 4: Check if we're in an iframe (debug tool or Warpcast embed)
  if (window.self !== window.top) {
    return true;
  }
  
  // Method 5: Check if parent frame is Farcaster (for iframe embeds)
  try {
    if (window.parent !== window && window.parent.location.hostname.includes('farcaster')) {
      return true;
    }
  } catch (e) {
    // Cross-origin frame access blocked - likely in Farcaster debug tool
    return true;
  }
  
  return false;
}

// Lazy-load the Farcaster SDK only when needed
let sdkInstance = null;
let sdkPromise = null;

export async function getFarcasterSDK() {
  if (sdkInstance) return sdkInstance;
  
  if (!sdkPromise) {
    sdkPromise = import('@farcaster/miniapp-sdk').then((module) => {
      sdkInstance = module.sdk;
      return sdkInstance;
    });
  }
  
  return sdkPromise;
}

// Initialize the Farcaster SDK (call this when app is ready to display)
export async function initFarcasterSDK() {
  if (!isFarcasterMiniApp()) return null;
  
  try {
    const sdk = await getFarcasterSDK();
    
    // Tell Warpcast we're ready to display (hides splash screen)
    await sdk.actions.ready();
    
    console.log('[Farcaster] SDK initialized');
    return sdk;
  } catch (error) {
    console.error('[Farcaster] SDK init error:', error);
    return null;
  }
}

// Get the current Farcaster user context
export async function getFarcasterContext() {
  if (!isFarcasterMiniApp()) return null;
  
  try {
    const sdk = await getFarcasterSDK();
    const context = await sdk.context;
    return context;
  } catch (error) {
    console.error('[Farcaster] Context error:', error);
    return null;
  }
}
