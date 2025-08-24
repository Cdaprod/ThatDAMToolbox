'use client';

// Permissions model configuration form.
// Example: <PermissionsModelForm tenant="acme" />

import * as React from 'react';
import { Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { SettingsCard } from '../common/SettingsCard';
import { api } from '../../lib/api/client';
import { useToast } from '../../providers/ToastProvider';

export function PermissionsModelForm({ tenant }: { tenant: string }) {
  const { toast } = useToast();
  const [rbacScheme, setRbacScheme] = React.useState<'basic'|'advanced'>('basic');
  const [policyPreview, setPolicyPreview] = React.useState('');

  React.useEffect(() => {
    (async () => {
      try {
        const data = await api<{ permissions: { rbacScheme: 'basic'|'advanced'; policyPreview: string } }>(
          `/api/tenants/${tenant}/permissions`,
        );
        setRbacScheme(data.permissions.rbacScheme);
        setPolicyPreview(data.permissions.policyPreview || '');
      } catch {}
    })();
  }, [tenant]);

  async function onSave() {
    try {
      await api(`/api/tenants/${tenant}/permissions`, {
        method: 'PUT',
        json: { permissions: { rbacScheme, policyPreview } },
      });
      toast('success', 'Permissions model saved.');
    } catch {
      toast('error', 'Permissions model update failed.');
    }
  }

  return (
    <SettingsCard title="Permissions Model" action={<Button onClick={onSave} variant="contained">Save</Button>}>
      <Stack spacing={2}>
        <TextField select label="RBAC Scheme" value={rbacScheme} onChange={(e) => setRbacScheme(e.target.value as any)}>
          <MenuItem value="basic">Basic</MenuItem>
          <MenuItem value="advanced">Advanced</MenuItem>
        </TextField>
        <TextField
          label="Policy Preview"
          value={policyPreview}
          onChange={(e) => setPolicyPreview(e.target.value)}
          placeholder="Read-only preview of your RBAC policy (JSON/YAML)…"
          minRows={4}
          multiline
        />
        {!policyPreview && <Typography color="text.secondary">No permissions model configured.</Typography>}
      </Stack>
    </SettingsCard>
  );
}

