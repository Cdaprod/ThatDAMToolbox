// /docker/web-app/src/providers/ModalProvider.tsx
'use client';
import { createContext, useContext, useState, ReactNode, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import CameraMonitorModal from '@/components/modals/CameraMonitorModal';
import DAMExplorerModal   from '@/components/modals/DAMExplorerModal';

type ToolKey =
  | 'camera-monitor'
  | 'dam-explorer'
  | 'explorer'
  | 'motion'
  | 'live'
  | 'witness'
  | null;

interface ModalCtx {
  openModal: (tool: Exclude<ToolKey, null>) => void;
  closeModal: () => void;
}

const Ctx = createContext<ModalCtx>({ openModal() {}, closeModal() {} });
export const useModal = () => useContext(Ctx);

export default function ModalProvider({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<ToolKey>(null);
  const closeModal = () => setTool(null);

  /** Renders the correct modal content */
  function RenderModal() {
    switch (tool) {
      case 'camera-monitor':
        return <CameraMonitorModal open onClose={closeModal} />;
      case 'dam-explorer':
        return <DAMExplorerModal open onClose={closeModal} />;
      /* add other compact modals here */
      default:
        return null;
    }
  }

  return (
    <Ctx.Provider value={{ openModal: setTool, closeModal }}>
      {children}
      {/* One instance mounted at root, renders whichever modal is active */}
      <RenderModal />
    </Ctx.Provider>
  );
}