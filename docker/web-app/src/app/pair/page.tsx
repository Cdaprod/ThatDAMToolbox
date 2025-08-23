'use client';

/**
 * PairPage displays a device code and polls the auth-bridge until approved.
 *
 * Users visit the provided verification URL, enter the code, and once approved
 * the page redirects back to the app.
 */
import { useEffect, useState } from 'react';

type PairStart = {
  user_code: string;
  verification_url: string;
  device_code: string;
};

export default function PairPage() {
  const [data, setData] = useState<PairStart | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'approved' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    async function start() {
      const res = await fetch('/auth-bridge/pair/start', { method: 'POST' });
      const body = await res.json();
      if (cancelled) return;
      setData(body);
      setStatus('pending');

      async function poll() {
        const r = await fetch(`/auth-bridge/pair/poll?device=${encodeURIComponent(body.device_code)}`);
        const b = await r.json();
        if (b.status === 'approved') {
          setStatus('approved');
          window.location.href = '/';
        } else if (!cancelled) {
          setTimeout(poll, 2000);
        }
      }
      poll();
    }
    start();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Pair this node</h1>
      {!data ? (
        <p>Preparing…</p>
      ) : (
        <>
          <p>
            Go to <b>{data.verification_url}</b> and enter code:
          </p>
          <div className="mt-4 rounded border p-4 text-2xl font-mono">{data.user_code}</div>
          <p className="mt-2 text-sm text-zinc-400">
            {status === 'pending' ? 'Waiting for approval…' : status}
          </p>
        </>
      )}
    </main>
  );
}

