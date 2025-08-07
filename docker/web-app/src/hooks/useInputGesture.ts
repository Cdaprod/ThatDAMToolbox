import { useEffect } from 'react';

export type Gesture =
  | { type: 'tap'; target: HTMLElement }
  | { type: 'hold'; target: HTMLElement }
  | { type: 'dbl'; target: HTMLElement };

/**
 * Normalises tap, long-press and double-tap across mouse, touch and keyboard.
 *
 * Example:
 * ```ts
 * const ref = useRef<HTMLDivElement>(null);
 * useInputGesture(ref, g => {
 *   if (g.type === 'tap') console.log('selected');
 *   if (g.type === 'hold') console.log('open menu');
 * });
 * ```
 */
export function useInputGesture(
  ref: React.RefObject<HTMLElement>,
  handler: (g: Gesture) => void,
  holdMs = 450,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let downTime: number | null = null;
    let tapCount = 0;
    let holdTimer: any;

    const cancel = () => {
      clearTimeout(holdTimer);
      downTime = null;
    };

    const onPointerDown = () => {
      downTime = Date.now();
      holdTimer = setTimeout(() => handler({ type: 'hold', target: el }), holdMs);
    };

    const onPointerUp = () => {
      if (downTime && Date.now() - downTime < holdMs) {
        tapCount++;
        const count = tapCount;
        setTimeout(() => {
          if (count === tapCount) {
            if (tapCount === 1) handler({ type: 'tap', target: el });
            else handler({ type: 'dbl', target: el });
            tapCount = 0;
          }
        }, 250);
      }
      cancel();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        handler({ type: 'tap', target: el });
      } else if (e.key === 'Enter') {
        handler({ type: 'dbl', target: el });
      } else if (e.key === 'F10' && e.shiftKey) {
        e.preventDefault();
        handler({ type: 'hold', target: el });
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('keydown', onKeyDown);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, handler, holdMs]);
}
