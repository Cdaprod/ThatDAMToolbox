import type { CSSProperties } from 'react';

export const gridStyle: CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

export const sizeClasses: Record<'small' | 'medium' | 'large', string> = {
  small: 'p-2 sm:p-4 min-h-[100px] sm:min-h-[120px]',
  medium: 'p-3 sm:p-6 min-h-[120px] sm:min-h-[160px]',
  large: 'p-4 sm:p-8 min-h-[140px] sm:min-h-[200px]',
};

export const iconClasses: Record<'small' | 'medium' | 'large', string> = {
  small: 'text-xl sm:text-2xl mb-2 sm:mb-3',
  medium: 'text-2xl sm:text-4xl mb-2 sm:mb-3',
  large: 'text-3xl sm:text-6xl mb-2 sm:mb-4',
};

export const titleClasses: Record<'small' | 'medium' | 'large', string> = {
  small: 'text-base sm:text-lg font-semibold text-center',
  medium: 'text-lg sm:text-xl font-semibold text-center',
  large: 'text-xl sm:text-2xl font-semibold text-center',
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

export const videoCardStyle: CSSProperties = { margin: 8, border: '1px solid #333', padding: 12 };
export const videoStyle: CSSProperties = { display: 'block', marginBottom: 8, maxWidth: '100%' };
export const videoInfoStyle: CSSProperties = { fontSize: 14, marginBottom: 4 };
export const sceneThumbStyle: CSSProperties = { marginRight: 2 };
export const uploadCardStyle: CSSProperties = { marginTop: 24 };
export const hiddenInputStyle: CSSProperties = { display: 'none' };
export const uploadButtonStyle: CSSProperties = { marginRight: 8 };

export const damAppContainerStyle: CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  background: 'var(--bg-color)',
};

export const damAppMainStyle: CSSProperties = {
  flex: 1,
  color: 'var(--text-color)',
  padding: 32,
};
