// /docker/web-app/src/lib/eventBus.ts
import mitt from 'mitt';               // 600 B tiny emitter – feels like Node’s EventEmitter

/** ----------------------------------------------------------------
 * 1)  Enumerate every event once, in TypeScript.
 *     These names should mirror your Python bus’s dataclass names.
 * ----------------------------------------------------------------*/
type BackendEvents = {
  /* ⇣ "hardware / capture" domain */
  'device-list'    : { path: string; width: number; height: number; fps: number }[];
  'recording-start': { file: string; timecode: string };
  'recording-stop' : { file?: string };
  'recording-status': { feed: string; elapsed: number };
  'battery'        : { level: number };
  'histogram'      : { buckets: number[] };
  'overlay-toggled': { overlay: 'focusPeaking' | 'zebras' | 'falseColor'; enabled: boolean };
  /* ⇣ "DAM / asset" domain */
  'assets-updated' : { ids: string[] };
  'batch-created'  : { id: string };
  /* …add as your Python bus grows… */
};

/** 2)  Local-only or UI-only events can live beside backend ones */
type UiEvents = {
  'toast'          : { msg: string; type?: 'info'|'success'|'error' };
  'route-change'   : { to: string };
};

export type AppEvents = BackendEvents & UiEvents;

/** 3)  Plain singleton emitter – no React, just JS */
export const bus = mitt<AppEvents>();