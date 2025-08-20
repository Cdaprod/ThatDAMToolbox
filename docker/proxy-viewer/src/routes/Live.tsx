import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import Player from '../components/Player';
import { createPlayer } from '@thatdamtoolbox/player';

export default function Live({ source }: { source?: string }) {
  const [device, setDevice] = useState<string | undefined>(source);
  const fallback = import.meta.env.VITE_DEFAULT_SOURCE || 'default';

  useEffect(() => {
    if (source) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/devices');
        const data = await res.json();
        const devices = data.devices || [];
        const first = devices.find((d: any) => d.is_available)?.path;
        if (!cancelled && first) setDevice(first);
      } catch (err) {
        console.error('device fetch failed', err);
      }
      if (!cancelled) setTimeout(poll, 5000);
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [source]);

  const chosen = device ?? fallback;

  return (
    <div class="h-screen flex flex-col">
      <Player source={chosen} create={createPlayer} />
    </div>
  );
}
