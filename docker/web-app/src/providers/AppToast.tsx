'use client';
import * as React from 'react';
import ToastProvider from '../components/providers/ToastProvider';

// Small wrapper if you prefer to mount globally in src/app/layout.tsx
export default function AppToast({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
