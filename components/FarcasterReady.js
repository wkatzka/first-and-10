/**
 * FarcasterReady - Component that calls sdk.actions.ready() on mount.
 * This is required for Farcaster Mini Apps to hide the splash screen.
 */
import { useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export default function FarcasterReady() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/04bf6a28-d7a2-43df-a19b-014adbbc98f0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FarcasterReady.js:12',message:'Component mounted',data:{sdkExists:!!sdk,actionsExists:!!sdk?.actions},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2-H3'})}).catch(()=>{});
  // #endregion

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/04bf6a28-d7a2-43df-a19b-014adbbc98f0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FarcasterReady.js:18',message:'useEffect running',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    // Call ready() to tell Farcaster we're done loading
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/04bf6a28-d7a2-43df-a19b-014adbbc98f0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FarcasterReady.js:23',message:'Calling sdk.actions.ready()',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion

    sdk.actions.ready().then(() => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/04bf6a28-d7a2-43df-a19b-014adbbc98f0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FarcasterReady.js:28',message:'ready() SUCCESS',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      console.log('[Farcaster] ready() success');
    }).catch((err) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/04bf6a28-d7a2-43df-a19b-014adbbc98f0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'FarcasterReady.js:33',message:'ready() ERROR',data:{error:String(err)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      console.log('[Farcaster] ready() error:', err);
    });
  }, []);

  return null;
}
