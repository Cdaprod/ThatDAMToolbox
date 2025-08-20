import { h } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';

export default function Player({
  source,
  create,
}: {
  source: string;
  create: (el: HTMLVideoElement, opts: { source: string }) => () => void;
}) {
  const el = useRef<HTMLVideoElement>(null);

  useLayoutEffect(() => {
    if (!el.current) return;
    const destroy = create(el.current, { source });
    return () => destroy();
  }, [source, create]);

  return <video ref={el} autoplay playsinline class="w-full h-full" />;
}
