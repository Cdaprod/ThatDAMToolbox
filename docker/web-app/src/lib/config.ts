// Application-wide frontend configuration
// Update environment variables to adjust runtime behavior.

export const AppConfig = {
  mediaApiBase: process.env.NEXT_PUBLIC_MEDIA_API_BASE ?? '',
  enableLocalAnalysis: true,
  defaultSuffix: '_trimidle',
} as const;

