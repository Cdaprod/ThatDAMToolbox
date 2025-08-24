'use client';

// Tenant domains configuration form.
// Example: <DomainsForm tenant="acme" />

import * as React from 'react';
import { Button, Stack, TextField, Typography, Chip } from '@mui/material';
import { SettingsCard } from '../common/SettingsCard';
import { api } from '../../lib/api/client';
import { useToast } from '../../providers/ToastProvider';

export function DomainsForm({ tenant }: { tenant: string }) {
  const { toast } = useToast();
  const [defaultSubdomain, setDefaultSubdomain] = React.useState('');
  const [customDomainsCsv, setCsv] = React.useState('');

  React.useEffect(() => {
    (async () => {
      try {
        const data = await api<{ domains: { defaultSubdomain: string; customDomains: string[] } }>(
          `/api/tenants/${tenant}/domains`,
        );
        setDefaultSubdomain(data.domains.defaultSubdomain || '');
        setCsv((data.domains.customDomains || []).join(', '));
      } catch {/* empty is ok */}
    })();
  }, [tenant]);

  async function onSave() {
    const customDomains = customDomainsCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await api(`/api/tenants/${tenant}/domains`, {
        method: 'PUT',
        json: { domains: { defaultSubdomain, customDomains } },
      });
      toast('success', 'Domain settings saved.');
    } catch {
      toast('error', 'Domain update failed. Please verify DNS settings.');
    }
  }

  return (
    <SettingsCard title="Domains" action={<Button onClick={onSave} variant="contained">Save</Button>}>
      <Stack spacing={2}>
        <TextField label="Default Subdomain" value={defaultSubdomain} onChange={(e) => setDefaultSubdomain(e.target.value)} placeholder={`${tenant}.thatdam.local`}/>
        <TextField label="Custom Domains (comma-separated)" value={customDomainsCsv} onChange={(e) => setCsv(e.target.value)}
          placeholder="media.cdaprod.dev, studio.cdaprod.dev"/>
        {!customDomainsCsv && (
          <Typography color="text.secondary">No custom domains connected.</Typography>
        )}
        {!!customDomainsCsv && (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {customDomainsCsv.split(',').map((d) => d.trim()).filter(Boolean).map((d) => <Chip key={d} label={d}/>)}
          </Stack>
        )}
      </Stack>
    </SettingsCard>
  );
}

