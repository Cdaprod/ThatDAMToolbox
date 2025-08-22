// /docker/web-app/src/app/[tenant]/access-control/page.tsx
// Tenant member and role management.
'use client';

import { useState } from 'react';
import StatusBar from '../../../components/DAMExplorer/StatusBar';
import PolicyPreviewWidget from '../../../components/PolicyPreviewWidget';

export default function AccessControlPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [rolesOpen, setRolesOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const sendInvite = (email: string) => {
    const ok = email.includes('@');
    setToast({ msg: ok ? 'Invitation sent.' : 'Couldn\'t send invitation. Check the email and try again.', type: ok ? 'success' : 'error' });
    setInviteOpen(false);
  };

  const updateRoles = () => {
    setToast({ msg: 'Roles updated.', type: 'success' });
    setRolesOpen(false);
  };

  return (
    <section className="max-w-3xl mx-auto py-8 space-y-8">
      <h1 className="text-2xl font-bold">Access Control</h1>

      <div className="space-y-2">
        <h2 className="font-semibold">Members</h2>
        <p className="text-sm text-muted">No members in this tenant yet.</p>
        <button onClick={() => setInviteOpen(true)} className="px-2 py-1 border rounded">Invite Member</button>
      </div>

      {inviteOpen && (
        <div className="space-y-2 border p-4">
          <h3 className="font-semibold">Invite Member</h3>
          <label className="block text-sm">Email Address<input className="border p-1 w-full" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}/></label>
          <label className="block text-sm"><input type="checkbox"/> Restrict to Allowed Domains</label>
          <label className="block text-sm">Expiration (days)<input className="border p-1 w-full"/></label>
          <button onClick={() => sendInvite(inviteEmail)} className="px-2 py-1 border rounded">Send</button>
          <p className="text-sm text-muted">No pending invitations.</p>
        </div>
      )}

      <div className="space-y-2">
        <button onClick={() => setRolesOpen(true)} className="px-2 py-1 border rounded">Edit Roles</button>
        {rolesOpen && (
          <div className="space-y-2 border p-4">
            <h3 className="font-semibold">Edit Roles</h3>
            <label className="block text-sm">Assign Roles<input className="border p-1 w-full"/></label>
            <label className="block text-sm">Remove Roles<input className="border p-1 w-full"/></label>
            <button onClick={updateRoles} className="px-2 py-1 border rounded">Save</button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">SSO Enforcement Preview</h2>
        <PolicyPreviewWidget />
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Access Changes</h2>
        <p className="text-sm text-muted">No recent access changes.</p>
      </div>

      <StatusBar message={toast?.msg} type={toast?.type} onDismiss={() => setToast(null)} />
    </section>
  );
}
