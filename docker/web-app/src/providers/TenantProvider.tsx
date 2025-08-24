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

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';

// React context holding the active tenant identifier
const TenantContext = createContext<string>('default');

/**
 * Hook to access the current tenant value.
 */
export function useTenant(): string {
  return useContext(TenantContext);
}

interface TenantProviderProps {
  tenant?: string;
  children: React.ReactNode;
}

/**
 * Wrap parts of the app that are tenant aware. If no tenant prop is provided,
 * the value is derived from the current route parameters on the server and
 * from the pathname on the client after mount.
 */
export default function TenantProvider({ tenant, children }: TenantProviderProps) {
  const params = useParams();
  const pathname = usePathname();
  const search = useSearchParams();

  const initialSlug =
    tenant ??
    (typeof params?.tenant === 'string'
      ? params.tenant
      : Array.isArray(params?.tenant)
      ? params.tenant[0]
      : 'default');

  const [slug, setSlug] = useState<string>(initialSlug);

  useEffect(() => {
    if (tenant) {
      setSlug(tenant);
      return;
    }
    const parts = (pathname || '/').split('/').filter(Boolean);
    setSlug(parts.length > 0 ? decodeURIComponent(parts[0]) : 'default');
  }, [tenant, pathname, search]);

  const value = useMemo(() => slug, [slug]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
