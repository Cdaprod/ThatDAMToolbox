// /docker/web-app/components/modals/DAMExplorerModal.tsx
'use client';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import DAMExplorer from '@/components/DAMExplorer';

interface Props {
  open: boolean;
  onClose(): void;
}

export default function DAMExplorerModal({ open, onClose }: Props) {
  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0 backdrop-blur-0"
          enterTo="opacity-100 backdrop-blur-sm"
          leave="ease-in duration-150"
          leaveFrom="opacity-100 backdrop-blur-sm"
          leaveTo="opacity-0 backdrop-blur-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        {/* Panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-6xl max-h-[85vh] rounded-xl bg-white shadow-xl overflow-hidden flex flex-col">
              <header className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">DAM Explorer</h3>
                <button
                  onClick={onClose}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </header>

              <div className="flex-1 overflow-auto bg-gray-50">
                <DAMExplorer compact />
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}