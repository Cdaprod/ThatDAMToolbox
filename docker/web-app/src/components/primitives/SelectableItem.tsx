'use client';
import { ReactNode, useRef } from 'react';
import clsx from 'clsx';
import { useInputGesture } from '@/hooks/useInputGesture';
import { useSelection } from '@/state/selection';
import type { Action } from '@/types/actions';
import { bus } from '@/lib/eventBus';

interface Props {
  id: string;
  actions: Action[];
  children: ReactNode;
  className?: string;
}

export default function SelectableItem({ id, actions, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { ids, toggle } = useSelection();

  useInputGesture(ref, (g) => {
    if (g.type === 'tap') toggle(id);
    if (g.type === 'dbl') bus.emit('preview', { id });
    if (g.type === 'hold') {
      const set = new Set(ids);
      set.add(id);
      bus.emit('action-sheet', { ids: Array.from(set), actions });
    }
  });

  return (
    <div
      ref={ref}
      tabIndex={0}
      className={clsx(ids.has(id) && 'is-selected', className)}
    >
      {children}
    </div>
  );
}
