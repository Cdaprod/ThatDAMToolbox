// /docker/web-app/src/hooks/useEvent.ts
import { useEffect } from 'react';
import { bus, AppEvents } from '@/lib/eventBus';

export function useEvent<K extends keyof AppEvents>(
  name: K,
  cb: (data: AppEvents[K]) => void,
) {
  useEffect(() => {
    bus.on(name, cb);
    return () => bus.off(name, cb);
  }, [name, cb]);
}

export const useEmit = () => bus.emit;