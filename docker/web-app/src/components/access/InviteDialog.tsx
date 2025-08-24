'use client';

// Dialog to invite a new member to the tenant.
// Example: <InviteDialog tenant="acme" open onClose={() => {}} onSuccess={() => {}} />

import * as React from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Switch, TextField, Typography
} from '@mui/material';
import { api } from '../../lib/api/client';
import { useToast } from '../../providers/ToastProvider';

export function InviteDialog({
  tenant, open, onClose, onSuccess,
}: {
  tenant: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = React.useState('');
  const [restrict, setRestrict] = React.useState(true);
  const [days, setDays] = React.useState<number>(7);

  async function onSend() {
    try {
      await api(`/api/tenants/${tenant}/members`, {
        method: 'POST',
        json: { email, restrictToAllowedDomains: restrict, expiresInDays: days },
      });
      toast('success', 'Invitation sent.');
      onSuccess();
      onClose();
    } catch {
      toast('error', 'Couldn’t send invitation. Check the email and try again.');
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Invite Member</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormControlLabel control={<Switch checked={restrict} onChange={(e) => setRestrict(e.target.checked)} />} label="Restrict to Allowed Domains" />
          <TextField type="number" label="Expiration (days)" value={days} onChange={(e) => setDays(Number(e.target.value))} />
          {/* Pending invitations UI out of scope for brevity; empty state message below */}
          <Typography color="text.secondary">No pending invitations.</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onSend} variant="contained">Send Invite</Button>
      </DialogActions>
    </Dialog>
  );
}

