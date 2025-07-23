// docker/web-app/lib/videoQueries.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { videoApi, Device, MotionExtractPayload, MotionJob } from './videoApi';

/* ---------------- simple GETs ---------------- */
export const useHealth   = () =>
  useQuery({ queryKey: ['health'], queryFn: videoApi.health, staleTime: 60_000 });

export const useDevices  = () =>
  useQuery<Device[]>({ queryKey: ['devices'], queryFn: videoApi.listDevices });

/* ---------------- mutations ------------------ */
export const useStartWitness = () =>
  useMutation({ mutationFn: videoApi.witnessStart });

export const useMotionExtract = () =>
  useMutation<MotionJob, unknown, MotionExtractPayload>({
    mutationFn: videoApi.motionExtract,
  });