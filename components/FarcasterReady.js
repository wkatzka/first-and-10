/**
 * FarcasterReady - Component that calls sdk.actions.ready() on mount.
 * This is required for Farcaster Mini Apps to hide the splash screen.
 */
'use client';

import { useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export default function FarcasterReady() {
  useEffect(() => {
    // Call ready() to tell Farcaster we're done loading
    sdk.actions.ready().then(() => {
      console.log('[Farcaster] ready() success');
    }).catch((err) => {
      console.log('[Farcaster] ready() error (expected outside Warpcast):', err);
    });
  }, []);

  return null;
}
