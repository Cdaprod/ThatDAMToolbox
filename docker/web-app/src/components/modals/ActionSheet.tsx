'use client';
import { useEffect, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { bus } from '@/lib/eventBus';
import type { Action } from '@/types/actions';

interface Ctx {
  ids: string[];
  actions: Action[];
}

export default function ActionSheet() {
  const [ctx, setCtx] = useState<Ctx | null>(null);

  useEffect(() => {
    const handler = (d: Ctx) => setCtx(d);
    bus.on('action-sheet', handler);
    return () => bus.off('action-sheet', handler);
  }, []);

  return (
    <Transition.Root show={!!ctx} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => setCtx(null)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <Dialog.Panel className="w-full max-w-sm rounded-xl bg-white shadow-xl">
              <div className="p-2">
                {ctx?.actions.map(({ label, icon: Icon, handler }) => (
                  <button
                    key={label}
                    onClick={() => {
                      handler(ctx.ids);
                      setCtx(null);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 rounded hover:bg-gray-100 text-left"
                  >
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
