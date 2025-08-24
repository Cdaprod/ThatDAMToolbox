'use client';

// Storage backend configuration form.
// Example: <StorageForm tenant="acme" />

import * as React from 'react';
import { Button, Stack, TextField, Typography } from '@mui/material';
import { SettingsCard } from '../common/SettingsCard';
import { api } from '../../lib/api/client';
import { useToast } from '@/providers/ToastProvider';

export function StorageForm({ tenant }: { tenant: string }) {
  const { toast } = useToast();
  const [endpoint, setEndpoint] = React.useState('');
  const [bucket, setBucket] = React.useState('');

  React.useEffect(() => {
    (async () => {
      try {
        const data = await api<{ storage: { endpoint: string; bucket: string } }>(
          `/api/tenants/${tenant}/storage`,
        );
        setEndpoint(data.storage.endpoint || '');
        setBucket(data.storage.bucket || '');
      } catch {}
    })();
  }, [tenant]);

  async function onSave() {
    try {
      await api(`/api/tenants/${tenant}/storage`, {
        method: 'PUT',
        json: { storage: { endpoint, bucket } },
      });
      toast('success', 'Storage settings saved.');
    } catch {
      toast('error', 'Storage settings couldn’t be saved. Confirm endpoint details.');
    }
  }

  return (
    <SettingsCard title="Storage" action={<Button onClick={onSave} variant="contained">Save</Button>}>
      <Stack spacing={2}>
        <TextField label="Endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://minio.example.com" />
        <TextField label="Bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} placeholder="thatdam-assets" />
        {!endpoint && !bucket && <Typography color="text.secondary">No storage backend configured.</Typography>}
      </Stack>
    </SettingsCard>
  );
}

