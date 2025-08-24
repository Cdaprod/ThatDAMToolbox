'use client';

// Widget to preview SSO policy by evaluating an email.
// Example: <PolicyPreviewWidget tenant="acme" />

import * as React from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useToast } from '../../providers/ToastProvider';
import { api } from '../../lib/api/client';

export function PolicyPreviewWidget({ tenant }: { tenant: string }) {
  const { toast } = useToast();
  const [email, setEmail] = React.useState('');
  const [result, setResult] = React.useState<null | 'allow' | 'deny'>(null);

  async function onEval() {
    setResult(null);
    try {
      const res = await api<{ allowed: boolean; reason?: string }>(
        `/api/policy/evaluate`,
        { method: 'POST', json: { tenant, email } },
      );
      setResult(res.allowed ? 'allow' : 'deny');
    } catch (e) {
      toast('error', 'Could not evaluate policy.');
    }
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        SSO Policy Preview
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center">
        <TextField
          label="Email Address"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
        />
        <Button onClick={onEval} variant="contained">Evaluate</Button>
      </Stack>
      {result && (
        <Typography sx={{ mt: 1 }}>
          {result === 'allow'
            ? 'This email meets the tenant’s SSO policy.'
            : 'This email is rejected by current SSO rules.'}
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Help: Enter an email to see if current SSO rules would allow sign-in or auto-join.
      </Typography>
    </Box>
  );
}

