'use client';
import { useEffect, useState } from 'react';

/**
 * useIsClient – returns true after the component mounts on the client.
 *
 * Example:
 *   const isClient = useIsClient();
 */
export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
}
