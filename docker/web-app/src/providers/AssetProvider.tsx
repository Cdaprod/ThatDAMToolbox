// /docker/web-app/src/providers/AssetProvider.tsx
'use client';

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useMemo,
} from 'react';
import { bus } from '../lib/eventBus';
import { createAsset, listAssets, listFolders, moveAssets, deleteAssets, Asset, FolderNode } from '../lib/apiAssets';
import { useCapture }     from './CaptureContext'; // to get timecode, overlays, etc
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { videoApi } from '../lib/videoApi'; // assumes you add a vectorSearch endpoint here

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
  foldersLoading: boolean;
  view: Asset[];                     // filtered or vector results
  filters: Filters;
  setFilters: (upd: Partial<Filters>) => void;
  vectorSearch: (q: string) => Promise<void>;
  move: (ids: string[], toPath: string) => Promise<void>;
  remove: (ids: string[]) => Promise<void>;
  refresh: () => void;
}

// ─── Context & Hook ────────────────────────────────────────────────────
export const AssetCtx = createContext<AssetCtx | null>(null);
export const useAssets = () => {
  const ctx = useContext(AssetCtx);
  if (!ctx) throw new Error('useAssets must be inside <AssetProvider>');
  return ctx;
};

// ─── Provider ──────────────────────────────────────────────────────────
export default function AssetProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  // 1) raw fetch
  const {
    data: assets = [],
    refetch: refetchAssets,
  } = useQuery({
    queryKey: ['assets'],     // must be inside the object
    queryFn: listAssets,
    staleTime: 60_000,
  });

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: listFolders,
    staleTime: 60_000,
  });

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
    foldersLoading,
    view,
    filters,
    setFilters: upd => {
      setVectorResults(null);           // clear vector mode whenever filters change
      setFilters(prev => ({ ...prev, ...upd }));
    },
    vectorSearch,
    move: (ids, toPath) => moveMut.mutateAsync({ ids, toPath }).then(() => {}),
    remove: ids => deleteMut.mutateAsync(ids).then(() => {}),
    refresh: refetchAssets,
  };
  
  // …inside AssetProvider, after you’ve set up your queries/mutations/view…
  // grab whatever you need out of your CaptureContext
  const {
    // you’ll need to expand CaptureContext to expose these:
    selectedDevice,
    selectedCodec,
    deviceInfo,       // { width, height, fps }
    timecode,         // e.g. "00:00:12:05"
    overlays,         // { focusPeaking, zebras, falseColor }
    histogramData,    // number[]
    recordingTime,    // in seconds
  } = useCapture();

  // whenever the backend tells us "recording has stopped," create a new DAM asset
  React.useEffect(() => {
    const handleStop = (data: { file?: string }) => {
      const payload = {
        filename:      data.file ?? 'unknown',
        device:        selectedDevice,
        codec:         selectedCodec,
        resolution:    `${deviceInfo.width}x${deviceInfo.height}`,
        fps:           deviceInfo.fps,
        duration:      recordingTime,
        timecodeStart: timecode,
        overlays,
        histogram:     histogramData,
        recordedAt:    new Date().toISOString(),
      };

      createAsset(payload)
        .then(() => qc.invalidateQueries({ queryKey: ['assets'] }))
        .catch(err => console.error('Failed to create asset:', err));
    };

    bus.on('recording-stop', handleStop);
    return () => void bus.off('recording-stop', handleStop);
  }, [
    selectedDevice,
    selectedCodec,
    deviceInfo,
    timecode,
    overlays,
    histogramData,
    recordingTime,
    qc,
  ]);

  return <AssetCtx.Provider value={value}>{children}</AssetCtx.Provider>;
}
