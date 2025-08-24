'use client';

import { useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import clsx    from 'clsx';
import { FolderOpen, ArrowUpRight } from 'lucide-react';

/* ---- lazy-load the full explorer --------------------------------------- */
const AssetExplorer = dynamic(
  () =>
    import('@/components/DAMExplorer').then(
      (m) => m.default ?? (m as any).DAMExplorer ?? (() => null)
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center">
        <span className="animate-pulse text-sm text-gray-500">loading…</span>
      </div>
    ),
  }
);

/* ---- props -------------------------------------------------------------- */
type Props = {
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  title?: string;
  footer?: ReactNode;
};

/* ---- card --------------------------------------------------------------- */
export default function ExplorerCard({
  orientation = 'vertical',
  className,
  title = 'DAM Explorer',
  footer,
}: Props) {
  const [open, setOpen] = useState(false);

  const isVert = orientation === 'vertical';

  return (
    <>
      {/* the card that shows on the dashboard grid */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          'group relative w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800',
          isVert ? 'aspect-[3/4]' : 'flex aspect-video items-center',
          className,
        )}
      >
        {/* icon */}
        <div
          className={clsx(
            'flex h-full items-center justify-center',
            isVert ? '' : 'h-full w-1/3',
          )}
        >
          <FolderOpen className="h-12 w-12 text-blue-600 group-hover:scale-105 transition" />
        </div>

        {/* label & hint */}
        <div
          className={clsx(
            'flex flex-col justify-center',
            isVert ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/30 p-4' : 'w-2/3 p-6 text-left',
          )}
        >
          <h3 className="text-base font-semibold text-white drop-shadow-sm dark:text-gray-50">
            {title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-gray-200 dark:text-gray-300">
            Browse, search & tag every asset in the DAM – double-tap to multi-select.
          </p>
          {footer && <div className="mt-2">{footer}</div>}
        </div>

        {/* subtle arrow */}
        <ArrowUpRight className="absolute right-2 top-2 h-4 w-4 text-gray-300 group-hover:text-white transition" />
      </button>

      {/* full-screen modal with the real explorer */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative h-[90vh] w-[95vw] max-w-7xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900">
            {/* close btn */}
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/20 p-2 text-white backdrop-blur hover:bg-black/40"
            >
              ✕
            </button>

            {/* heavy component */}
            <AssetExplorer />
          </div>
        </div>
      )}
    </>
  );
}