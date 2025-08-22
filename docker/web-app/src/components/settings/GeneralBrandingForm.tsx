'use client';

// Tenant branding form.
// Example: <GeneralBrandingForm tenant="acme" />

import * as React from 'react';
import { Button, Stack, TextField, MenuItem } from '@mui/material';
import { SettingsCard } from '../common/SettingsCard';
import { api } from '../../lib/api/client';
import { useToast } from '../providers/ToastProvider';

export function GeneralBrandingForm({ tenant }: { tenant: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [tenantName, setTenantName] = React.useState('');
  const [logoUrl, setLogoUrl] = React.useState('');
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>('system');

  React.useEffect(() => {
    (async () => {
      try {
        const data = await api<{ branding: { tenantName: string; logoUrl?: string; theme: 'light'|'dark'|'system' } }>(
          `/api/tenants/${tenant}/settings`,
        );
        setTenantName(data.branding.tenantName || '');
        setLogoUrl(data.branding.logoUrl || '');
        setTheme(data.branding.theme || 'system');
      } catch {
        // If empty, show empty state placeholders
      } finally {
        setLoading(false);
      }
    })();
  }, [tenant]);

  async function onSave() {
    try {
      await api(`/api/tenants/${tenant}/settings`, {
        method: 'PUT',
        json: { branding: { tenantName, logoUrl, theme } },
      });
      toast('success', 'Branding updated.');
    } catch {
      toast('error', 'Unable to update branding. Check your permissions and try again.');
    }
  }

  return (
    <SettingsCard title="General & Branding" action={<Button onClick={onSave} variant="contained">Save Changes</Button>}>
      <Stack spacing={2}>
        <TextField label="Tenant Name" value={tenantName} onChange={(e) => setTenantName(e.target.value)}
          placeholder="e.g. Cdaprod" helperText={!tenantName && !loading ? 'No branding set yet. Add a name and logo to make this tenant yours.' : ''}/>
        <TextField label="Logo URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://.../logo.png"/>
        <TextField select label="Theme" value={theme} onChange={(e) => setTheme(e.target.value as any)}>
          <MenuItem value="system">System</MenuItem>
          <MenuItem value="light">Light</MenuItem>
          <MenuItem value="dark">Dark</MenuItem>
        </TextField>
      </Stack>
    </SettingsCard>
  );
}

