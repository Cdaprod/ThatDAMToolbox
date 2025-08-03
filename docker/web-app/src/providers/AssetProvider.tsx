// /docker/web-app/src/providers/AssetProvider.tsx
'use client';

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useMemo,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAssets,
  listFolders,
  moveAssets,
  deleteAssets,
  Asset,
  FolderNode,
} from '@/lib/apiAssets';
import { videoApi } from '@/lib/videoApi'; // assumes you add a vectorSearch endpoint here

// ─── Types ──────────────────────────────────────────────────────────────
interface Filters {
  text?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  types?: string[];
  durations?: string[];
}

interface AssetCtx {
  assets: Asset[];                   // raw list
  folders: FolderNode[];             // raw folder tree
  view: Asset[];                     // filtered or vector results
  filters: Filters;
  setFilters: (upd: Partial<Filters>) => void;
  vectorSearch: (q: string) => Promise<void>;
  move: (ids: string[], toPath: string) => Promise<void>;
  remove: (ids: string[]) => Promise<void>;
  refresh: () => void;
}

// ─── Context & Hook ────────────────────────────────────────────────────
const AssetCtx = createContext<AssetCtx | null>(null);
export const useAssets = () => {
  const ctx = useContext(AssetCtx);
  if (!ctx) throw new Error('useAssets must be inside <AssetProvider>');
  return ctx;
};

// ─── Provider ──────────────────────────────────────────────────────────
export default function AssetProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  // 1) raw fetch
+  const {
+    data: assets = [],
+    refetch: refetchAssets,
+  } = useQuery({
+    queryKey: ['assets'],     // must be inside the object
+    queryFn: listAssets,
+    staleTime: 60_000,
+  });

+  const { data: folders = [] } = useQuery({
+    queryKey: ['folders'],
+    queryFn: listFolders,
+    staleTime: 60_000,
+  });

  // 2) move / delete mutations
  const moveMut = useMutation({
    mutationFn: ({ ids, toPath }: { ids: string[]; toPath: string }) =>
      moveAssets(ids, toPath),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['assets'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (ids: string | string[]) =>
      deleteAssets(ids),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['assets'] }),
  });
  
  // 3) filter + vector state
  const [filters, setFilters] = useState<Filters>({});
  const [vectorResults, setVectorResults] = useState<Asset[] | null>(null);

  // 4) vector-search helper
  const vectorSearch = async (q: string) => {
    // your backend must expose something like `videoApi.vectorSearch`
    const hits = await videoApi.vectorSearch(q);
    setVectorResults(hits);
  };

  // 5) compute the "view" list
  const view = useMemo(() => {
    if (vectorResults) {
      return vectorResults;
    }
    return assets.filter(a => {
      // text search
      if (filters.text) {
        const t = filters.text.toLowerCase();
        if (
          !a.name.toLowerCase().includes(t) &&
          !a.tags.some(tag => tag.toLowerCase().includes(t))
        ) {
          return false;
        }
      }
      // tag filters
      if (filters.tags?.length) {
        if (!filters.tags.some(tag => a.tags.includes(tag))) {
          return false;
        }
      }
      // TODO: dateFrom/dateTo/types/durations logic here
      return true;
    });
  }, [assets, filters, vectorResults]);

  // 6) expose context value
  const value: AssetCtx = {
    assets,
    folders,
    view,
    filters,
    setFilters: upd => {
      setVectorResults(null);           // clear vector mode whenever filters change
      setFilters(prev => ({ ...prev, ...upd }));
    },
    vectorSearch,
    move: (ids, toPath) => moveMut.mutateAsync({ assetIds: ids, toPath }),
    remove: ids => deleteMut.mutateAsync(ids),
    refresh: refetchAssets,
  };

  return <AssetCtx.Provider value={value}>{children}</AssetCtx.Provider>;
}