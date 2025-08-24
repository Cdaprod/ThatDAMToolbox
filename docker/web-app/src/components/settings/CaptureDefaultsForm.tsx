'use client';

// Capture defaults configuration.
// Example: <CaptureDefaultsForm tenant="acme" />

import * as React from 'react';
import { Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { SettingsCard } from '../common/SettingsCard';
import { api } from '../../lib/api/client';
import { useToast } from '../../providers/ToastProvider';

export function CaptureDefaultsForm({ tenant }: { tenant: string }) {
  const { toast } = useToast();
  const [frameRate, setFrameRate] = React.useState<number>(30);
  const [codec, setCodec] = React.useState<'h264'|'h265'|'prores'|'vp9'|'av1'>('h264');
  const [overlayProfile, setOverlayProfile] = React.useState<'none'|'basic'|'broadcast'|'studio'>('basic');

  React.useEffect(() => {
    (async () => {
      try {
        const data = await api<{ capture: { frameRate: number; codec: typeof codec; overlayProfile: typeof overlayProfile } }>(
          `/api/tenants/${tenant}/capture-defaults`,
        );
        setFrameRate(data.capture.frameRate);
        setCodec(data.capture.codec);
        setOverlayProfile(data.capture.overlayProfile);
      } catch {}
    })();
  }, [tenant]);

  async function onSave() {
    try {
      await api(`/api/tenants/${tenant}/capture-defaults`, {
        method: 'PUT',
        json: { capture: { frameRate, codec, overlayProfile } },
      });
      toast('success', 'Capture defaults saved.');
    } catch {
      toast('error', 'Failed to update capture defaults.');
    }
  }

  return (
    <SettingsCard title="Capture Defaults" action={<Button onClick={onSave} variant="contained">Save</Button>}>
      <Stack spacing={2}>
        <TextField type="number" label="Frame Rate (fps)" value={frameRate} onChange={(e) => setFrameRate(Number(e.target.value))} />
        <TextField select label="Codec" value={codec} onChange={(e) => setCodec(e.target.value as any)}>
          {['h264','h265','prores','vp9','av1'].map((c) => <MenuItem key={c} value={c}>{c.toUpperCase()}</MenuItem>)}
        </TextField>
        <TextField select label="Overlay Profile" value={overlayProfile} onChange={(e) => setOverlayProfile(e.target.value as any)}>
          {['none','basic','broadcast','studio'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>
        {!frameRate && <Typography color="text.secondary">No default capture settings defined.</Typography>}
      </Stack>
    </SettingsCard>
  );
}

