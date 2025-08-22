'use client';

// Displays invite and role-change audit entries.
// Example: <AccessAuditViewer tenant="acme" />

import * as React from 'react';
import { api } from '../../lib/api/client';
import { List, ListItem, ListItemText, Typography } from '@mui/material';
import { useToast } from '../providers/ToastProvider';

export function AccessAuditViewer({ tenant }: { tenant: string }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<any[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await api<{ items: any[] }>(`/api/tenants/${tenant}/audit`);
        setRows(data.items.filter((x) => x.kind === 'invite' || x.kind === 'role-change'));
      } catch {
        toast('error', 'Couldn’t load access audit log.');
      }
    })();
  }, [tenant]);

  if (!rows.length) return <Typography color="text.secondary">No recent access changes.</Typography>;

  return (
    <List>
      {rows.map((r) => (
        <ListItem key={r.id} divider>
          <ListItemText primary={`${r.summary} • ${new Date(r.at).toLocaleString()}`} secondary={`${r.actor} • ${r.target}`} />
        </ListItem>
      ))}
    </List>
  );
}

