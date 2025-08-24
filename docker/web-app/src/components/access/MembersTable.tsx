'use client';

// Displays tenant members and allows editing roles.
// Example: <MembersTable tenant="acme" onEditRoles={fn} />

import * as React from 'react';
import {
  Box, Chip, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Typography
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { api } from '../../lib/api/client';
import { useToast } from '../../providers/ToastProvider';

export type MemberRow = { id: string; email: string; roles: string[]; lastActive: string };

export function MembersTable({
  tenant,
  onEditRoles,
}: {
  tenant: string;
  onEditRoles: (m: MemberRow) => void;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<MemberRow[]>([]);

  async function load() {
    try {
      const data = await api<{ members: MemberRow[] }>(`/api/tenants/${tenant}/members`);
      setRows(data.members);
    } catch {
      toast('error', 'Unable to fetch members. Please refresh.');
    }
  }

  React.useEffect(() => { load(); }, [tenant]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>Access Control</Typography>
      {rows.length === 0 ? (
        <Typography color="text.secondary">No members in this tenant yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Last Active</TableCell>
              <TableCell align="right">Manage</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.email}</TableCell>
                <TableCell>
                  {m.roles.map((r) => <Chip key={r} size="small" sx={{ mr: .5 }} label={r}/>)}
                </TableCell>
                <TableCell>{new Date(m.lastActive).toLocaleString()}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => onEditRoles(m)} aria-label="Edit Roles"><EditIcon/></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

