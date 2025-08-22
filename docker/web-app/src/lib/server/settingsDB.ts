// In-memory data store used by API routes and demos.
// Example: ensureTenant('acme');

export type TenantKey = string;

export type Branding = {
  tenantName: string;
  logoUrl?: string;
  theme: 'light' | 'dark' | 'system';
};

export type Domains = {
  defaultSubdomain: string;
  customDomains: string[];
};

export type SSO = {
  enabled: boolean;
  allowedDomains: string[];
  enforceGoogleOnly: boolean;
};

export type StorageCfg = {
  endpoint: string;
  bucket: string;
};

export type CaptureDefaults = {
  frameRate: number;
  codec: 'h264' | 'h265' | 'prores' | 'vp9' | 'av1';
  overlayProfile: 'none' | 'basic' | 'broadcast' | 'studio';
};

export type PermissionsModel = {
  rbacScheme: 'basic' | 'advanced';
  policyPreview: string;
};

export type TenantSettings = {
  branding: Branding;
  domains: Domains;
  sso: SSO;
  storage: StorageCfg;
  capture: CaptureDefaults;
  permissions: PermissionsModel;
};

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  kind: 'create' | 'update' | 'invite' | 'role-change' | 'security' | 'policy-eval';
  target: string;
  summary: string;
  diff?: Record<string, unknown>;
};

export type Member = {
  id: string;
  email: string;
  roles: string[];
  lastActive: string;
};

export type Invitation = {
  id: string;
  tenant: string;
  email: string;
  restrictToAllowedDomains: boolean;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired';
};

export type Profile = {
  name: string;
  avatarUrl?: string;
  timeZone: string;
  defaultTenant?: string;
  mfaEnabled: boolean;
  recoveryFactors: string[];
  googleConnected: boolean;
};

// ------------------------- ephemeral DB -------------------------
const tenants = new Map<TenantKey, TenantSettings>();
const audits = new Map<TenantKey, AuditEntry[]>();
const members = new Map<TenantKey, Member[]>();
const invitations = new Map<TenantKey, Invitation[]>();
let profile: Profile = {
  name: 'David Cannan',
  timeZone: 'America/New_York',
  mfaEnabled: false,
  recoveryFactors: [],
  googleConnected: true,
  avatarUrl: '',
  defaultTenant: undefined,
};

// Seed helper so pages have something to load.
export function ensureTenant(tenant: TenantKey) {
  if (!tenants.has(tenant)) {
    tenants.set(tenant, {
      branding: { tenantName: tenant, logoUrl: '', theme: 'system' },
      domains: { defaultSubdomain: `${tenant}`, customDomains: [] },
      sso: { enabled: false, allowedDomains: [], enforceGoogleOnly: false },
      storage: { endpoint: '', bucket: '' },
      capture: { frameRate: 30, codec: 'h264', overlayProfile: 'basic' },
      permissions: { rbacScheme: 'basic', policyPreview: '' },
    });
  }
  if (!audits.has(tenant)) audits.set(tenant, []);
  if (!members.has(tenant))
    members.set(tenant, [
      {
        id: 'u_1',
        email: 'owner@cdaprod.dev',
        roles: ['owner', 'admin'],
        lastActive: new Date().toISOString(),
      },
    ]);
  if (!invitations.has(tenant)) invitations.set(tenant, []);
}

// CRUD-like helpers
export function getTenantSettings(tenant: TenantKey) {
  ensureTenant(tenant);
  return tenants.get(tenant)!;
}

export function setTenantSettings<K extends keyof TenantSettings>(
  tenant: TenantKey,
  section: K,
  value: TenantSettings[K],
  actor: string,
) {
  ensureTenant(tenant);
  const current = tenants.get(tenant)!;
  const before = current[section];
  current[section] = value as any;
  tenants.set(tenant, current);
  pushAudit(tenant, {
    kind: 'update',
    actor,
    target: section,
    summary: `Updated ${section}`,
    diff: { before, after: value },
  });
  return current;
}

export function pushAudit(
  tenant: TenantKey,
  entry: Omit<AuditEntry, 'id' | 'at'>,
) {
  ensureTenant(tenant);
  const row: AuditEntry = {
    id: `a_${Math.random().toString(36).slice(2)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  audits.get(tenant)!.unshift(row);
  return row;
}

export function listAudit(tenant: TenantKey) {
  ensureTenant(tenant);
  return audits.get(tenant)!;
}

export function listMembers(tenant: TenantKey) {
  ensureTenant(tenant);
  return members.get(tenant)!;
}

export function updateMemberRoles(
  tenant: TenantKey,
  memberId: string,
  roles: string[],
  actor: string,
) {
  ensureTenant(tenant);
  const list = members.get(tenant)!;
  const m = list.find((x) => x.id === memberId);
  if (!m) return null;
  const before = [...m.roles];
  m.roles = roles;
  pushAudit(tenant, {
    kind: 'role-change',
    actor,
    target: `member:${m.email}`,
    summary: `Roles updated`,
    diff: { before, after: roles },
  });
  return m;
}

export function createInvitation(
  tenant: TenantKey,
  email: string,
  restrict: boolean,
  days: number,
  actor: string,
) {
  ensureTenant(tenant);
  const inv: Invitation = {
    id: `inv_${Math.random().toString(36).slice(2)}`,
    tenant,
    email,
    restrictToAllowedDomains: restrict,
    expiresAt: new Date(Date.now() + days * 864e5).toISOString(),
    status: 'pending',
  };
  invitations.get(tenant)!.unshift(inv);
  pushAudit(tenant, {
    kind: 'invite',
    actor,
    target: `invite:${email}`,
    summary: `Invitation created (expires in ${days}d)`,
  });
  return inv;
}

export function listInvitations(tenant: TenantKey) {
  ensureTenant(tenant);
  return invitations.get(tenant)!;
}

// Account/Profile
export function getProfile() {
  return profile;
}

export function setProfile(update: Partial<Profile>) {
  profile = { ...profile, ...update };
  return profile;
}

