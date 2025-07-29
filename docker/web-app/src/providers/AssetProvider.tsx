// /docker/web-app/src/providers/AssetProvider.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryKey,
} from '@tanstack/react-query';

import {
  listAssets,
  listFolders,
  moveAssets,
  deleteAssets,
  Asset,
  FolderNode,
} from '@/lib/apiAssets';


/* ------------------------------------------------------------------ */
/*  Context types                                                     */
/* ------------------------------------------------------------------ */
interface Ctx {
  assets: Asset[];
  folders: FolderNode[];
  refresh(): void;
  move(ids: string[], toPath: string): Promise<void>;
  remove(ids: string[]): Promise<void>;
}

const AssetCtx = createContext<Ctx | null>(null);
export const useAssets = () => {
  const ctx = useContext(AssetCtx);
  if (!ctx) throw new Error('useAssets must be inside <AssetProvider>');
  return ctx;
};

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */
export default function AssetProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  /* ---------------  READ  --------------- */
  const {
    data: assets = [],
    refetch: refetchAssets,
  } = useQuery({
    queryKey: ['assets'] as QueryKey,
    queryFn : listAssets,
    staleTime: 60_000,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'] as QueryKey,
    queryFn : listFolders,
    staleTime: 60_000,
  });

  /* ---------------  WRITE  --------------- */
  const moveMut = useMutation({
    mutationFn: ({ ids, toPath }: { ids: string[]; toPath: string }) =>
      moveAssets(ids, toPath),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (ids: string[]) => deleteAssets(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });

  /* ---------------  CTX VALUE  --------------- */
  const value: Ctx = {
    assets,
    folders,
    refresh: refetchAssets,
    move  : (ids, p) => moveMut.mutateAsync({ ids, toPath: p }),
    remove: (ids)   => deleteMut.mutateAsync(ids),
  };

  return <AssetCtx.Provider value={value}>{children}</AssetCtx.Provider>;
}