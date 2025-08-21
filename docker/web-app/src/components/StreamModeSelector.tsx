// Simple example component demonstrating mode-based transport selection.
// Usage:
// <StreamModeSelector />
import React, { useEffect, useState } from 'react';
import { fetchRegistry, selectTransport, ViewMode } from '@thatdamtoolbox/stream-registry';

export default function StreamModeSelector() {
  const [mode, setMode] = useState<ViewMode>('director');
  const [transport, setTransport] = useState<string>('');

  useEffect(() => {
    let active = true;
    fetchRegistry()
      .then((reg) => {
        const first = reg[0];
        if (active) setTransport(selectTransport(first, mode) || '');
      })
      .catch(() => setTransport(''));
    return () => {
      active = false;
    };
  }, [mode]);

  return (
    <div>
      <div>transport: {transport}</div>
      <button data-mode="director" onClick={() => setMode('director')}>director</button>
      <button data-mode="focus-pull" onClick={() => setMode('focus-pull')}>focus pull</button>
    </div>
  );
}
