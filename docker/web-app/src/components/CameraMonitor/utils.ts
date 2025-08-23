/**
 * Helper functions for CameraMonitor component.
 */

/**
 * Merge previously seen device IDs with a new list.
 * Safely handles non-array inputs.
 */
export function mergeDeviceIds(prev: unknown, now: string[]): string[] {
  const prevList = Array.isArray(prev) ? prev : [];
  return Array.from(new Set([...prevList, ...now]));
}

/**
 * Convert a numeric aspect ratio to a CSS `aspect-ratio` string.
 * Falls back to a sensible default when the ratio is missing.
 */
export function toCssAspect(value: number | null, fallback = '16 / 9'): string {
  return value && value > 0 ? `${value}` : fallback;
}
