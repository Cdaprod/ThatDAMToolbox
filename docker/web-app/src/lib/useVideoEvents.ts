// lib/useVideoEvents.ts
import { useVideoWs } from './useVideoWs';

export interface VideoEventBattery   { type: 'battery'; level: number }
export interface VideoEventRecTime   { type: 'recTime'; seconds: number }
export type     VideoEvent           = VideoEventBattery | VideoEventRecTime;

export function useVideoEvents(handlers: {
  onBattery?: (l:number)=>void;
  onRecTime?: (s:number)=>void;
}) {
  useVideoWs(ev => {
    let msg: VideoEvent;
    try { msg = JSON.parse(ev.data); } catch { return; }

    if (msg.type === 'battery'  && handlers.onBattery) handlers.onBattery(msg.level);
    if (msg.type === 'recTime'  && handlers.onRecTime) handlers.onRecTime(msg.seconds);
  });
}