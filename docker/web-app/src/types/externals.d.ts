/**
 * Stub type declarations for external modules used in the web app.
 *
 * These packages are not installed in the minimal test environment, but
 * TypeScript needs their module definitions during compilation.
 *
 * Example:
 * ```ts
 * import { Button } from '@mui/material';
 * ```
 */
declare module '@mui/material';
declare module '@mui/icons-material';
declare module '@emotion/react';
declare module '@emotion/styled';
declare module 'next-auth/react';
declare module 'next-auth' {
  export type NextAuthOptions = any;
}
declare module 'next-auth/providers/google';

