// Zod schemas for tenant settings and policy evaluation.
// Example: BrandingSchema.parse({ tenantName: 'acme', logoUrl: '', theme: 'light' });

import { z } from 'zod';

export const BrandingSchema = z.object({
  tenantName: z.string().min(1),
  logoUrl: z.string().url().or(z.string().length(0)),
  theme: z.enum(['light', 'dark', 'system']),
});

export const DomainsSchema = z.object({
  defaultSubdomain: z.string().min(1),
  customDomains: z.array(z.string().min(1)).default([]),
});

export const SSOSchema = z.object({
  enabled: z.boolean(),
  allowedDomains: z
    .array(z.string().email().or(z.string().regex(/^[\w.-]+\.[A-Za-z]{2,}$/)))
    .default([]),
  enforceGoogleOnly: z.boolean(),
});

export const StorageSchema = z.object({
  endpoint: z.string().url().or(z.string().min(1)),
  bucket: z.string().min(1),
});

export const CaptureDefaultsSchema = z.object({
  frameRate: z.coerce.number().int().min(1).max(240),
  codec: z.enum(['h264', 'h265', 'prores', 'vp9', 'av1']),
  overlayProfile: z.enum(['none', 'basic', 'broadcast', 'studio']),
});

export const PermissionsSchema = z.object({
  rbacScheme: z.enum(['basic', 'advanced']),
  policyPreview: z.string().default(''),
});

