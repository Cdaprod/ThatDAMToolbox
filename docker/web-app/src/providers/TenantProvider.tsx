/**
 * TenantProvider supplies the current tenant string to all descendants.
 *
 * Example usage:
 * ```tsx
 * <TenantProvider tenant="acme">
 *   <MyComponent />
 * </TenantProvider>
 * ```
 */
'use client';

import React, { createContext, useContext } from 'react';

// React context holding the active tenant identifier
const TenantContext = createContext<string>('default');

/**
 * Hook to access the current tenant value.
 */
export function useTenant(): string {
  return useContext(TenantContext);
}

interface TenantProviderProps {
  tenant: string;
  children: React.ReactNode;
}

/**
 * Wrap parts of the app that are tenant aware.
 */
export default function TenantProvider({ tenant, children }: TenantProviderProps) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}
