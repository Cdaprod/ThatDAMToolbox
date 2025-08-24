'use client';

// SSO configuration form.
// Example: <SsoForm tenant="acme" />

import * as React from 'react';
import { Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import { SettingsCard } from '../common/SettingsCard';
import { api } from '../../lib/api/client';
import { useToast } from '@/providers/ToastProvider';
import { PolicyPreviewWidget } from '../policy/PolicyPreview';

export function SsoForm({ tenant }: { tenant: string }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = React.useState(false);
  const [allowedCsv, setAllowedCsv] = React.useState('');
  const [googleOnly, setGoogleOnly] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await api<{ sso: { enabled: boolean; allowedDomains: string[]; enforceGoogleOnly: boolean } }>(
          `/api/tenants/${tenant}/sso`,
        );
        setEnabled(data.sso.enabled);
        setAllowedCsv((data.sso.allowedDomains || []).join(', '));
        setGoogleOnly(data.sso.enforceGoogleOnly);
      } catch { /* empty is ok */ }
    })();
  }, [tenant]);

  async function onSave() {
    const allowedDomains = allowedCsv.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await api(`/api/tenants/${tenant}/sso`, {
        method: 'PUT',
        json: { sso: { enabled, allowedDomains, enforceGoogleOnly: googleOnly } },
      });
      toast('success', 'SSO policy updated.');
    } catch {
      toast('error', 'SSO configuration couldn’t be saved. Check values and permissions.');
    }
  }

  return (
    <SettingsCard title="Single Sign-On" action={<Button onClick={onSave} variant="contained">Save</Button>}>
      <Stack spacing={2}>
        <FormControlLabel control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />} label="Enable SSO" />
        <TextField label="Allowed Domains (comma-separated)" value={allowedCsv} onChange={(e) => setAllowedCsv(e.target.value)} placeholder="cdaprod.dev, example.com"/>
        <FormControlLabel control={<Switch checked={googleOnly} onChange={(e) => setGoogleOnly(e.target.checked)} />} label="Enforce Google-only Sign-in" />
        {!enabled && <Typography color="text.secondary">SSO is disabled for this tenant.</Typography>}
        <PolicyPreviewWidget tenant={tenant} />
      </Stack>
    </SettingsCard>
  );
}

