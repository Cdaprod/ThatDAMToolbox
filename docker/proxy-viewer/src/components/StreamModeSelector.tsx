// UI helper that toggles between director and focus-pull modes.
// Usage:
// <StreamModeSelector onSelect={url => ...} />
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { fetchRegistry, selectTransport, ViewMode } from '@thatdamtoolbox/stream-registry';

export default function StreamModeSelector({ onSelect }: { onSelect: (url: string) => void }) {
  const [mode, setMode] = useState<ViewMode>('director');

  useEffect(() => {
    let active = true;
    fetchRegistry()
      .then((reg) => {
        const first = reg[0];
        const url = selectTransport(first, mode) || '';
        if (active) onSelect(url);
      })
      .catch(() => onSelect(''));
    return () => {
      active = false;
    };
  }, [mode, onSelect]);

  return (
    <div>
      <button data-mode="director" onClick={() => setMode('director')}>director</button>
      <button data-mode="focus-pull" onClick={() => setMode('focus-pull')}>focus pull</button>
    </div>
  );
}
