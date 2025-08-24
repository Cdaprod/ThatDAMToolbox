'use client';

/**
 * ClientOnly ensures that its children are rendered only after the component
 * has mounted on the client. During SSR it outputs a stable placeholder so the
 * markup matches on the server and client.
 *
 * Example:
 *   <ClientOnly>
 *     <ThemeProvider>...</ThemeProvider>
 *   </ClientOnly>
 */
import { useEffect, useState } from 'react';

export default function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div data-client-only="" style={{ display: 'contents' }} />;
  return <>{children}</>;
}
