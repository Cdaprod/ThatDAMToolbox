'use client';

// Dialog to edit member roles.
// Example: <EditRolesDialog tenant="acme" member={m} open onClose={fn} onSaved={fn} />

import * as React from 'react';
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { api } from '../../lib/api/client';
import { useToast } from '@/providers/ToastProvider';
import type { MemberRow } from './MembersTable';

export function EditRolesDialog({
  tenant, member, open, onClose, onSaved,
}: {
  tenant: string;
  member: MemberRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [rolesCsv, setRolesCsv] = React.useState('');

  React.useEffect(() => {
    setRolesCsv(member ? member.roles.join(', ') : '');
  }, [member]);

  async function onSave() {
    try {
      const roles = rolesCsv.split(',').map((s) => s.trim()).filter(Boolean);
      await api(`/api/tenants/${tenant}/members/${member!.id}/roles`, {
        method: 'PUT',
        json: { roles },
      });
      toast('success', 'Roles updated.');
      onSaved();
      onClose();
    } catch {
      toast('error', 'Role update failed. Ensure you have sufficient permissions.');
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Roles</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Assign Roles (comma-separated)" value={rolesCsv} onChange={(e) => setRolesCsv(e.target.value)} />
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {rolesCsv.split(',').map((s) => s.trim()).filter(Boolean).map((r) => <Chip key={r} label={r} />)}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}

