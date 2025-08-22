'use client';

// Tenant access control management page.
// Example: /mytenant/access-control

import * as React from 'react';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { MembersTable, type MemberRow } from '../../../components/access/MembersTable';
import { InviteDialog } from '../../../components/access/InviteDialog';
import { EditRolesDialog } from '../../../components/access/EditRolesDialog';
import { AccessAuditViewer } from '../../../components/access/AccessAuditLog';
import { SsoEnforcementTester } from '../../../components/access/SsoEnforcementTester';

export default function AccessControlPage({ params }: { params: { tenant: string } }) {
  const tenant = params.tenant;
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [editMember, setEditMember] = React.useState<MemberRow | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Access Control</Typography>
        <Button variant="contained" onClick={() => setInviteOpen(true)}>Invite Member</Button>
      </Stack>

      <MembersTable
        key={reloadKey}
        tenant={tenant}
        onEditRoles={(m) => setEditMember(m)}
      />

      <Box sx={{ mt: 4 }}>
        <SsoEnforcementTester tenant={tenant} />
      </Box>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Access Changes</Typography>
        <AccessAuditViewer tenant={tenant} />
      </Box>

      <InviteDialog
        tenant={tenant}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={() => setReloadKey((k) => k + 1)}
      />
      <EditRolesDialog
        tenant={tenant}
        member={editMember}
        open={!!editMember}
        onClose={() => setEditMember(null)}
        onSaved={() => setReloadKey((k) => k + 1)}
      />
    </Container>
  );
}

