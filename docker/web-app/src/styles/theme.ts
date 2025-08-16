// /docker/web-app/src/styles/theme.ts
import type { CSSProperties } from 'react';

export const gridStyle: CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

export const cardBaseClasses = 'bg-surface rounded-lg shadow-sm border border-color-border';

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
  background: 'black',
};

export const videoCardStyle:    CSSProperties = { margin: 8, border: '1px solid #333', padding: 12 };
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
  color:      available ? '#fff' : '#888',
  background: available ? ''     : '#333',
});

export const sliderBackgroundStyle = (percent: number): CSSProperties => ({
  background: `linear-gradient(to right, #ff4500 0%, #ff4500 ${percent}%, #666 ${percent}%, #666 100%)`,
});

export const batteryLevelStyle = (level: number): CSSProperties => ({
  width: `${level}%`,
});

export const statusClasses: Record<'success' | 'error' | 'warning' | 'info', string> = {
  success: 'bg-green-100 text-green-800 border-green-300',
  error:   'bg-red-100   text-red-800   border-red-300',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  info:    'bg-blue-100  text-blue-800  border-blue-300',
};

export const dashboardColorClasses: Record<string, string> = {
  'camera-monitor': 'text-indigo-500',
  'dam-explorer':   'text-purple-500',
  motion:           'text-pink-500',
  live:             'text-green-500',
  witness:          'text-yellow-500',
  explorer:         'text-blue-500',
  nodes:            'text-cyan-500',
};
