// /docker/web-app/src/providers/ModalProvider.tsx
'use client';
import { createContext, useContext, useState, ReactNode, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import CameraMonitorModal from '@/components/modals/CameraMonitorModal';
import DAMExplorerModal   from '@/components/modals/DAMExplorerModal';
import ProvisionDeviceModal from '@/components/modals/ProvisionDeviceModal';

type ToolKey =
  | 'camera-monitor'
  | 'dam-explorer'
  | 'motion'
  | 'live'
  | 'witness'
  | 'provision-device'
  | null;

interface ModalCtx {
  openModal: (tool: Exclude<ToolKey, null>) => void;
  closeModal: () => void;
}

const Ctx = createContext<ModalCtx>({ openModal() {}, closeModal() {} });
export const useModal = () => useContext(Ctx);

export default function ModalProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [tool, setTool] = useState<ToolKey>(null);
  const closeModal = () => setTool(null);

  useEffect(() => setMounted(true), []);

  /** Renders the correct modal content */
  function RenderModal() {
    switch (tool) {
      case 'camera-monitor':
        return <CameraMonitorModal open onClose={closeModal} />;
      case 'dam-explorer':
        return <DAMExplorerModal open onClose={closeModal} />;
      case 'provision-device':
        return <ProvisionDeviceModal open onClose={closeModal} />;
      /* add other compact modals here */
      default:
        return null;
    }
  }

  if (!mounted) return <div data-modal-placeholder="" style={{ display: 'contents' }} />;

  return (
    <Ctx.Provider value={{ openModal: setTool, closeModal }}>
      {children}
      {/* One instance mounted at root, renders whichever modal is active */}
      <RenderModal />
    </Ctx.Provider>
  );
}