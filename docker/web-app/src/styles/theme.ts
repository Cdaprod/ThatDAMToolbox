// /docker/web-app/src/styles/theme.ts
import type { CSSProperties } from 'react';

export const gridStyle: CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

export const cardBaseClasses = 'bg-surface rounded-xl shadow-md border border-color-border';

export const sizeClasses: Record<'small' | 'medium' | 'large', string> = {
  small:  'p-2 sm:p-4 min-h-[100px] sm:min-h-[120px]',
  medium: 'p-3 sm:p-6 min-h-[120px] sm:min-h-[160px]',
  large:  'p-4 sm:p-8 min-h-[140px] sm:min-h-[200px]',
};

export const iconClasses: Record<'small' | 'medium' | 'large', string> = {
  small:  'text-xl sm:text-2xl mb-2 sm:mb-3',
  medium: 'text-2xl sm:text-4xl mb-2 sm:mb-3',
  large:  'text-3xl sm:text-6xl mb-2 sm:mb-4',
};

export const titleClasses: Record<'small' | 'medium' | 'large', string> = {
  small:  'text-base sm:text-lg font-semibold text-center',
  medium: 'text-lg sm:text-xl font-semibold text-center',
  large:  'text-xl sm:text-2xl font-semibold text-center',
};

export const overlaySurfaceStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
};

export const monitorCanvasStyle: CSSProperties = {
  background: 'var(--color-monitor-canvas)',
};

export const videoCardStyle:    CSSProperties = { margin: 8, border: '1px solid var(--color-border)', padding: 12 };
export const videoStyle:        CSSProperties = { display: 'block', marginBottom: 8, maxWidth: '100%' };
export const videoInfoStyle:    CSSProperties = { fontSize: 14, marginBottom: 4 };
export const sceneThumbStyle:   CSSProperties = { marginRight: 2 };
export const uploadCardStyle:   CSSProperties = { marginTop: 24 };
export const hiddenInputStyle:  CSSProperties = { display: 'none' };
export const uploadButtonStyle: CSSProperties = { marginRight: 8 };

export const damAppContainerStyle: CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  width: '100vw',
  background: 'var(--bg-color)',
};

export const damAppMainStyle: CSSProperties = {
  flex: 1,
  width: '100%',
  color: 'var(--text-color)',
  padding: 32,
};

export const folderIndentStyle = (level: number): CSSProperties => ({
  marginLeft: `${level}rem`,
});

export const deviceOptionStyle = (available: boolean): CSSProperties => ({
  color:      available ? 'var(--color-surface)' : 'var(--color-muted)',
  background: available ? ''                    : 'var(--color-text)',
});

export const sliderBackgroundStyle = (percent: number): CSSProperties => ({
  background: `linear-gradient(to right, var(--color-slider-fill) 0%, var(--color-slider-fill) ${percent}%, var(--color-slider-track) ${percent}%, var(--color-slider-track) 100%)`,
});

export const batteryLevelStyle = (level: number): CSSProperties => ({
  width: `${level}%`,
});

export const statusClasses: Record<'success' | 'error' | 'warning' | 'info', string> = {
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success-border)]',
  error:   'bg-[var(--color-error-bg)]   text-[var(--color-error-text)]   border-[var(--color-error-border)]',
  warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]',
  info:    'bg-[var(--color-info-bg)]    text-[var(--color-info-text)]    border-[var(--color-info-border)]',
};

export const dashboardColorClasses: Record<string, string> = {
  'camera-monitor': 'text-[var(--color-camera-monitor)]',
  'dam-explorer':   'text-[var(--color-accent)]',
  'layered-explorer': 'text-[var(--color-accent)]',
  motion:           'text-[var(--color-motion)]',
  live:             'text-[var(--color-live)]',
  witness:          'text-[var(--color-witness)]',
  nodes:            'text-[var(--color-nodes)]',
  'trim-idle':      'text-[var(--color-trim-idle)]',
};
