// /docker/web-app/src/providers/AssetProvider.tsx
'use client';
import { createContext, useContext, ReactNode, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAssets, listFolders, moveAssets, deleteAssets, Asset, FolderNode } from '@/lib/apiAssets';

interface Ctx {
  assets: Asset[];
  folders: FolderNode[];
  refresh(): void;
  move(ids: string[], toPath: string): Promise<void>;
  remove(ids: string[]): Promise<void>;
}

const C = createContext<Ctx | null>(null);
export const useAssets = () => {
  const ctx = useContext(C);
  if (!ctx) throw new Error('useAssets must be in provider');
  return ctx;
};

export default function AssetProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  /* queries --------------------------------------------------------- */
  const { data: assets = [], refetch: refetchAssets } = useQuery(['assets'], listAssets);
  const { data: folders = [] } = useQuery(['folders'], listFolders);

  /* mutations ------------------------------------------------------- */
  const moveMut = useMutation(({ ids, toPath }: { ids: string[]; toPath: string }) =>
    moveAssets(ids, toPath), {
      onSuccess: () => qc.invalidateQueries(['assets']),
    });
  const deleteMut = useMutation((ids: string[]) => deleteAssets(ids), {
    onSuccess: () => qc.invalidateQueries(['assets']),
  });

  const value: Ctx = {
    assets,
    folders,
    refresh: refetchAssets,
    move: (ids, p) => moveMut.mutateAsync({ ids, toPath: p }),
    remove: (ids) => deleteMut.mutateAsync(ids),
  };

  return <C.Provider value={value}>{children}</C.Provider>;
}