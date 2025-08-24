'use client';

/**
 * AssetProvider fetches basic asset statistics from `/api/library/stats` and
 * exposes them via context. It ensures deterministic first paint by supplying
 * stable initial data for SSR.
 *
 * Example:
 *   <AssetProvider>
 *     <MyComponent />
 *   </AssetProvider>
 */
import { createContext, useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Asset { id: string; name: string; folder?: string; size?: number }

interface AssetCtx {
  assets: Asset[];
  loading: boolean;
  refresh: () => void;
}

const Ctx = createContext<AssetCtx | null>(null);
export const useAssets = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAssets must be inside <AssetProvider>');
  return ctx;
};

export default function AssetProvider({ children }: { children: React.ReactNode }) {
  const [refreshTick, setRefreshTick] = useState(0);

  const { data, isFetching } = useQuery({
    queryKey: ['assets', refreshTick],
    queryFn: async () => {
      const res = await fetch('/api/library/stats', { cache: 'no-store' });
      if (!res.ok) return { assetsList: [] as Asset[] };
      return (await res.json()) as { assetsList: Asset[] };
    },
    initialData: { assetsList: [] as Asset[] },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const value = useMemo<AssetCtx>(
    () => ({
      assets: data?.assetsList ?? [],
      loading: isFetching,
      refresh: () => setRefreshTick((t) => t + 1),
    }),
    [data, isFetching]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
