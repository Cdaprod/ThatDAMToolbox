// /docker/web-app/src/components/modals/ProvisionDeviceModal.tsx
'use client';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useEffect, useState } from 'react';

interface Claim {
  id: string;
  command: string;
}

interface Props {
  open: boolean;
  onClose(): void;
}

// Fetches a new claim from the API
// Example: await createClaim()
export async function createClaim(): Promise<Claim> {
  const res = await fetch('/api/claims/new');
  if (!res.ok) throw new Error('failed to create claim');
  return res.json();
}

export default function ProvisionDeviceModal({ open, onClose }: Props) {
  const [claim, setClaim] = useState<Claim | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let es: EventSource | null = null;

    createClaim()
      .then((c) => {
        setClaim(c);
        es = new EventSource(`/api/claims/${c.id}/watch`);
        es.onmessage = () => {
          setDone(true);
          es?.close();
        };
      })
      .catch((e) => setError(e.message));

    return () => {
      es?.close();
    };
  }, [open]);

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
            <Dialog.Panel className="w-full max-w-lg rounded-xl bg-white shadow-xl overflow-hidden flex flex-col">
              <header className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">Provision Device</h3>
                <button
                  onClick={onClose}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </header>
              <div className="p-4 space-y-4">
                {error && <p className="text-red-600">{error}</p>}
                {!error && !claim && <p>Generating join command...</p>}
                {claim && (
                  <div>
                    <p className="mb-2 text-sm">Run this on the device:</p>
                    <code className="block bg-gray-100 p-2 rounded text-sm break-all">
                      {claim.command}
                    </code>
                  </div>
                )}
                {done && <p className="text-green-600">Device provisioned.</p>}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
