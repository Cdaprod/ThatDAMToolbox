'use client';

// Global toast notifications using MUI Snackbar/Alert.
// Example: const { toast } = useToast(); toast('success', 'Saved!');

import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

type Toast = { id: number; kind: 'success' | 'error' | 'info'; msg: string };
const ToastCtx = createContext<{ toast: (kind: Toast['kind'], msg: string) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('ToastProvider missing');
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], msg: string) => {
    setQueue((q) => [...q, { id: Date.now() + Math.random(), kind, msg }]);
  }, []);
  const remove = (id: number) => setQueue((q) => q.filter((t) => t.id !== id));

  return (
    <ToastCtx.Provider value={{ toast: push }}>
      {children}
      {queue.map((t) => (
        <Snackbar
          key={t.id}
          open
          autoHideDuration={3500}
          onClose={() => remove(t.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert severity={t.kind} variant="filled" onClose={() => remove(t.id)}>
            {t.msg}
          </Alert>
        </Snackbar>
      ))}
    </ToastCtx.Provider>
  );
}

