'use client';

// Simple widget to test SSO email enforcement.
// Example: <SsoEnforcementTester tenant="acme" />

import * as React from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../lib/api/client';
import { useToast } from '@/providers/ToastProvider';

export function SsoEnforcementTester({ tenant }: { tenant: string }) {
  const { toast } = useToast();
  const [email, setEmail] = React.useState('');
  const [msg, setMsg] = React.useState<string | null>(null);

  async function check() {
    setMsg(null);
    try {
      const res = await api<{ allowed: boolean }>(`/api/policy/evaluate`, {
        method: 'POST',
        json: { tenant, email },
      });
      setMsg(res.allowed ? 'This email would be allowed.' : 'This email would be denied.');
    } catch {
      toast('error', 'Could not evaluate SSO policy.');
    }
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>Test SSO Rules</Typography>
      <Stack direction="row" spacing={2} alignItems="center">
        <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button variant="outlined" onClick={check}>Check Email</Button>
      </Stack>
      {msg && <Typography sx={{ mt: 1 }}>{msg}</Typography>}
    </Box>
  );
}

