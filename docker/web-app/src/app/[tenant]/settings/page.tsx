// /docker/web-app/src/app/[tenant]/settings/page.tsx
// Tenant-scoped settings hub with multiple sections.
'use client';

import { useState } from 'react';
import StatusBar from '../../../components/DAMExplorer/StatusBar';
import PolicyPreviewWidget from '../../../components/PolicyPreviewWidget';

export default function TenantSettingsPage() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const brandEmpty = true;
  const domainEmpty = true;
  const ssoDisabled = true;
  const storageEmpty = true;
  const captureEmpty = true;
  const permissionsEmpty = true;

  const save = (okMsg: string, errMsg: string, ok = true) => {
    setToast({ msg: ok ? okMsg : errMsg, type: ok ? 'success' : 'error' });
  };

  return (
    <section className="max-w-2xl mx-auto py-8 space-y-8">
      <h1 className="text-2xl font-bold">Tenant Settings</h1>

      <div className="space-y-2">
        <h2 className="font-semibold">General & Branding</h2>
        <label className="block text-sm">Tenant Name<input className="border p-1 w-full"/></label>
        <label className="block text-sm">Logo<input className="border p-1 w-full"/></label>
        <label className="block text-sm">Theme<input className="border p-1 w-full"/></label>
        {brandEmpty && <p className="text-sm text-muted">No branding set yet. Add a name and logo to make this tenant yours.</p>}
        <button onClick={() => save('Branding updated.', 'Unable to update branding. Check your permissions and try again.')}
          className="px-2 py-1 border rounded">Save Changes</button>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Domains</h2>
        <label className="block text-sm">Default Subdomain<input className="border p-1 w-full"/></label>
        <label className="block text-sm">Custom Domains<input className="border p-1 w-full"/></label>
        {domainEmpty && <p className="text-sm text-muted">No custom domains connected.</p>}
        <button onClick={() => save('Domain settings saved.', 'Domain update failed. Please verify DNS settings.')}
          className="px-2 py-1 border rounded">Save</button>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Single Sign-On</h2>
        <label className="block text-sm"><input type="checkbox"/> Enable SSO</label>
        <label className="block text-sm">Allowed Domains (comma-separated)<input className="border p-1 w-full"/></label>
        <label className="block text-sm"><input type="checkbox"/> Enforce Google-only Sign-in</label>
        {ssoDisabled && <p className="text-sm text-muted">SSO is disabled for this tenant.</p>}
        <button onClick={() => save('SSO policy updated.', 'SSO configuration couldn’t be saved. Check values and permissions.')}
          className="px-2 py-1 border rounded">Save</button>
        <PolicyPreviewWidget />
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Storage</h2>
        <label className="block text-sm">Endpoint<input className="border p-1 w-full"/></label>
        <label className="block text-sm">Bucket<input className="border p-1 w-full"/></label>
        {storageEmpty && <p className="text-sm text-muted">No storage backend configured.</p>}
        <button onClick={() => save('Storage settings saved.', 'Storage settings couldn’t be saved. Confirm endpoint details.')}
          className="px-2 py-1 border rounded">Save</button>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Capture Defaults</h2>
        <label className="block text-sm">Frame Rate (fps)<input className="border p-1 w-full"/></label>
        <label className="block text-sm">Codec<input className="border p-1 w-full"/></label>
        <label className="block text-sm">Overlay Profile<input className="border p-1 w-full"/></label>
        {captureEmpty && <p className="text-sm text-muted">No default capture settings defined.</p>}
        <button onClick={() => save('Capture defaults saved.', 'Failed to update capture defaults.')}
          className="px-2 py-1 border rounded">Save</button>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Permissions Model</h2>
        <label className="block text-sm">RBAC Scheme<input className="border p-1 w-full"/></label>
        <label className="block text-sm">Policy Preview<input className="border p-1 w-full"/></label>
        {permissionsEmpty && <p className="text-sm text-muted">No permissions model configured.</p>}
        <button onClick={() => save('Permissions model saved.', 'Permissions model update failed.')}
          className="px-2 py-1 border rounded">Save</button>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Recent Changes</h2>
        <p className="text-sm text-muted">No recent settings changes.</p>
      </div>

      <StatusBar message={toast?.msg} type={toast?.type} onDismiss={() => setToast(null)} />
    </section>
  );
}
