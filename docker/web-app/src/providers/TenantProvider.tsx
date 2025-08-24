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

import { useParams } from 'next/navigation';

interface TenantProviderProps {
  tenant?: string;
  children: React.ReactNode;
}

/**
 * Wrap parts of the app that are tenant aware. If no tenant prop is provided,
 * the value is derived from the current route parameters.
 */
export default function TenantProvider({ tenant, children }: TenantProviderProps) {
  const params = useParams();
  const activeTenant =
    tenant ??
    (typeof params?.tenant === 'string'
      ? params.tenant
      : Array.isArray(params?.tenant)
      ? params.tenant[0]
      : 'default');

  return (
    <TenantContext.Provider value={activeTenant}>{children}</TenantContext.Provider>
  );
}
