// /docker/web-app/src/app/account/page.tsx
// User account management page.
'use client';

import { useState } from 'react';
import StatusBar from '../../components/DAMExplorer/StatusBar';

export default function AccountPage() {
  const [mfa, setMfa] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const saveProfile = () => setToast({ msg: 'Profile updated.', type: 'success' });
  const saveSecurity = () => setToast({ msg: 'Security settings updated.', type: 'success' });
  const disconnectGoogle = () => setToast({ msg: 'Google account disconnected.', type: 'success' });
  const setDefaultTenant = () => setToast({ msg: 'Default tenant set.', type: 'success' });

  return (
    <section className="max-w-xl mx-auto py-8 space-y-8">
      <h1 className="text-2xl font-bold">Account</h1>

      <div className="space-y-2">
        <h2 className="font-semibold">Profile</h2>
        <label className="block text-sm">Name<input className="border p-1 w-full"/></label>
        <label className="block text-sm">Avatar<input className="border p-1 w-full"/></label>
        <label className="block text-sm">Time Zone<input className="border p-1 w-full"/></label>
        <button onClick={saveProfile} className="px-2 py-1 border rounded">Save</button>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Security</h2>
        <label className="block text-sm"><input type="checkbox" checked={mfa} onChange={e => setMfa(e.target.checked)} /> Multi-Factor Authentication</label>
        <label className="block text-sm">Recovery Factors<input className="border p-1 w-full"/></label>
        <button onClick={saveSecurity} className="px-2 py-1 border rounded">{mfa ? 'Disable MFA' : 'Enable MFA'}</button>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Connected Identities</h2>
        <p className="text-sm">Google Account: <span className="text-muted">Connected</span></p>
        <button onClick={disconnectGoogle} className="px-2 py-1 border rounded">Disconnect Google</button>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Default Tenant</h2>
        <label className="block text-sm">Preferred Tenant<input className="border p-1 w-full"/></label>
        <button onClick={setDefaultTenant} className="px-2 py-1 border rounded">Save</button>
      </div>

      <StatusBar message={toast?.msg} type={toast?.type} onDismiss={() => setToast(null)} />
    </section>
  );
}
