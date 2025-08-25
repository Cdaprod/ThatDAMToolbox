// docker/web-app/lib/videoQueries.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { mediaApi, Device, MotionExtractPayload, MotionJob } from './mediaApi';

/* ---------------- simple GETs ---------------- */
export const useHealth   = () =>
  useQuery({ queryKey: ['health'], queryFn: mediaApi.health, staleTime: 60_000 });

export const useDevices  = () =>
  useQuery<Device[]>({ queryKey: ['devices'], queryFn: mediaApi.listDevices });

/* ---------------- mutations ------------------ */
export const useStartWitness = () =>
  useMutation({ mutationFn: mediaApi.witnessStart });

export const useMotionExtract = () =>
  useMutation<MotionJob, unknown, MotionExtractPayload>({
    mutationFn: mediaApi.motionExtract,
  });