'use client';

import * as React from 'react';
import {
  Avatar, Box, Button, Container, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography
} from '@mui/material';
import { api } from '../../lib/api/client';
import ToastProvider, { useToast } from '../../components/providers/ToastProvider';

type Profile = {
  name: string;
  avatarUrl?: string;
  timeZone: string;
  defaultTenant?: string;
  mfaEnabled: boolean;
  recoveryFactors: string[];
  googleConnected: boolean;
};

function AccountInner() {
  const { toast } = useToast();
  const [p, setP] = React.useState<Profile | null>(null);
  const [tenants] = React.useState<string[]>(['default', 'studio', 'ops']);

  React.useEffect(() => { (async () => { try { setP(await api<Profile>(`/api/account/profile`)); } catch {} })(); }, []);
  if (!p) return null;

  async function saveProfile() {
    try { const res = await api<Profile>(`/api/account/profile`, { method: 'PUT', json: p! }); setP(res); toast('success', 'Profile updated.'); }
    catch { toast('error', 'Failed to save profile.'); }
  }
  async function toggleMfa() {
    try { const res = await api<{ mfaEnabled: boolean }>(`/api/account/security`, { method: 'PUT', json: { mfaEnabled: !p!.mfaEnabled } }); setP({ ...p!, mfaEnabled: res.mfaEnabled }); toast('success', 'Security settings updated.'); }
    catch { toast('error', 'Couldn’t update security settings.'); }
  }
  async function disconnectGoogle() {
    try { const res = await api<{ googleConnected: boolean }>(`/api/account/identities`, { method: 'PUT', json: { action: 'disconnect-google' } }); setP({ ...p!, googleConnected: res.googleConnected }); toast('success', 'Google account disconnected.'); }
    catch { toast('error', 'Cannot disconnect Google account. Check tenant policies.'); }
  }
  async function setDefaultTenant(val: string) {
    try { const res = await api<{ defaultTenant: string }>(`/api/account/default-tenant`, { method: 'PUT', json: { defaultTenant: val } }); setP({ ...p!, defaultTenant: res.defaultTenant }); toast('success', 'Default tenant set.'); }
    catch { toast('error', 'Unable to set default tenant.'); }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>Account</Typography>

      {/* Profile */}
      <Typography variant="h6" sx={{ mb: 1 }}>Profile</Typography>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar src={p.avatarUrl} sx={{ width: 56, height: 56 }}>{p.name?.[0] || 'U'}</Avatar>
          <TextField label="Name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </Stack>
        <TextField label="Avatar" value={p.avatarUrl || ''} onChange={(e) => setP({ ...p, avatarUrl: e.target.value })} placeholder="https://.../me.png" />
        <TextField select label="Time Zone" value={p.timeZone} onChange={(e) => setP({ ...p, timeZone: e.target.value })}>
          {Intl.supportedValuesOf('timeZone').map((tz) => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
        </TextField>
        <Box>
          <Button variant="contained" onClick={saveProfile}>Save Profile</Button>
        </Box>
      </Stack>

      {/* Security */}
      <Typography variant="h6" sx={{ mb: 1 }}>Security</Typography>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <FormControlLabel control={<Switch checked={p.mfaEnabled} onChange={toggleMfa} />} label="Multi-Factor Authentication" />
        <Typography variant="body2" color="text.secondary">
          Recovery Factors: {p.recoveryFactors.length ? p.recoveryFactors.join(', ') : 'None'}
        </Typography>
      </Stack>

      {/* Connected Identities */}
      <Typography variant="h6" sx={{ mb: 1 }}>Connected Identities</Typography>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography>Google Account</Typography>
          <Typography color={p.googleConnected ? 'success.main' : 'text.secondary'}>
            {p.googleConnected ? 'Connected' : 'Not connected'}
          </Typography>
          {p.googleConnected && <Button onClick={disconnectGoogle}>Disconnect Google</Button>}
        </Stack>
      </Stack>

      {/* Default Tenant */}
      <Typography variant="h6" sx={{ mb: 1 }}>Default Tenant</Typography>
      <Stack spacing={2}>
        <TextField select label="Preferred Tenant" value={p.defaultTenant || ''} onChange={(e) => setDefaultTenant(e.target.value)}>
          {tenants.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
      </Stack>
    </Container>
  );
}

export default function AccountPage() {
  // local Toast boundary to avoid depending on global Root layout wiring differences
  return (
    <ToastProvider>
      <AccountInner />
    </ToastProvider>
  );
}

