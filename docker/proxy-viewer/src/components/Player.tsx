import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { createPlayer } from '@thatdamtoolbox/player';

export default function Player({ source }: { source: string }) {
  const el = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!el.current) return;
    const destroy = createPlayer(el.current, { source });
    return () => destroy();
  }, [source]);

  return <video ref={el} autoplay playsinline class="w-full h-full" />;
}
