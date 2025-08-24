'use client';

// Audit log viewer for settings changes.
// Example: <SettingsAuditLog tenant="acme" />

import * as React from 'react';
import { SettingsCard } from '../common/SettingsCard';
import { api } from '../../lib/api/client';
import { Alert, List, ListItem, ListItemText, Typography } from '@mui/material';
import { useToast } from '../../providers/ToastProvider';

export function SettingsAuditLog({ tenant }: { tenant: string }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<
    { id: string; at: string; actor: string; kind: string; target: string; summary: string }[]
  >([]);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await api<{ items: typeof rows }>(`/api/tenants/${tenant}/audit`);
        setRows(data.items);
      } catch {
        toast('error', 'Couldn’t load audit log.');
      }
    })();
  }, [tenant]);

  return (
    <SettingsCard title="Recent Changes">
      {rows.length === 0 ? (
        <Typography color="text.secondary">No recent settings changes.</Typography>
      ) : (
        <List>
          {rows.map((r) => (
            <ListItem key={r.id} divider>
              <ListItemText
                primary={`${r.summary} • ${new Date(r.at).toLocaleString()}`}
                secondary={`${r.actor} • ${r.kind} • ${r.target}`}
              />
            </ListItem>
          ))}
        </List>
      )}
    </SettingsCard>
  );
}

