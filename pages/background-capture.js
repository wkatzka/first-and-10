import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

function getBgCanvas() {
  return document.querySelector('canvas[aria-hidden="true"]');
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

async function nextFrame(count = 1) {
  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => requestAnimationFrame(() => r()));
  }
}

export default function BackgroundCapture({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const capture = async ({ hidePlays, freeze, type }) => {
    setBusy(true);
    setMessage(null);
    try {
      window.__F10_BG_OPTS = {
        ...(window.__F10_BG_OPTS || {}),
        enabled: true,
        hidePlays: !!hidePlays,
        paused: false, // ensure it draws at least one more frame
      };

      // Let background redraw with new settings
      await nextFrame(2);

      const c = getBgCanvas();
      if (!c) {
        setMessage('Could not find the background canvas.');
        return;
      }

      const mime = type === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = c.toDataURL(mime, type === 'jpg' ? 0.92 : undefined);
      downloadDataUrl(dataUrl, type === 'png' ? 'background-capture.png' : 'background-capture.jpg');

      if (freeze) {
        // Freeze the background in its current state.
        window.__F10_BG_OPTS = { ...(window.__F10_BG_OPTS || {}), paused: true };
        await nextFrame(1);
      }

      setMessage(`Downloaded ${type.toUpperCase()} from the actual live background canvas${hidePlays ? ' (plays hidden)' : ''}.`);
    } finally {
      setBusy(false);
    }
  };

  const unfreeze = async () => {
    window.__F10_BG_OPTS = { ...(window.__F10_BG_OPTS || {}), enabled: true, paused: false };
    // Kick the animation loop back on by forcing a resize event (effect has RAF running, but if paused it cancels; resize causes no restart)
    // Easiest: reload the page to restore normal behavior.
    router.reload();
  };

  if (!user) return null;

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="space-y-4">
        <div className="f10-panel p-4">
          <h1 className="text-2xl f10-title text-white">Background Capture</h1>
          <p className="text-sm text-gray-400">
            This downloads a JPEG/PNG from the <span className="text-gray-200">actual canvas behind your app</span>, so you can compare what code produces vs what you see.
          </p>
        </div>

        <div className="f10-panel p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => capture({ hidePlays: true, freeze: false, type: 'jpg' })}
              className="px-4 py-2 rounded-xl text-sm text-white disabled:opacity-50"
              style={{ background: 'rgba(0,229,255,0.18)', border: '1px solid rgba(0,229,255,0.22)' }}
            >
              Download JPEG (no arrows)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => capture({ hidePlays: false, freeze: false, type: 'jpg' })}
              className="px-4 py-2 rounded-xl text-sm text-white disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Download JPEG (with arrows)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => capture({ hidePlays: true, freeze: true, type: 'jpg' })}
              className="px-4 py-2 rounded-xl text-sm text-white disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Download + Freeze (no arrows)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={unfreeze}
              className="px-4 py-2 rounded-xl text-sm text-white disabled:opacity-50"
              style={{ background: 'rgba(255,0,128,0.16)', border: '1px solid rgba(255,0,128,0.22)' }}
            >
              Unfreeze (reload)
            </button>
          </div>

          {message && <div className="text-sm text-gray-300">{message}</div>}
          <div className="text-xs text-gray-500">
            Note: “Freeze” stops the background animation on this device until you reload.
          </div>
        </div>
      </div>
    </Layout>
  );
}

