// /docker/web-app/src/app/[tenant]/settings/page.tsx
// Tenant-scoped settings hub.
'use client';

import { useState } from 'react';

const tabs = [
  'General & Branding',
  'Domains',
  'SSO',
  'Storage',
  'Capture Defaults',
  'Permissions Model',
  'Audit Log',
];

const copy = {
  general: {
    empty: 'No branding set yet. Add a name and logo to make this tenant yours.',
    error: 'Unable to update branding. Check your permissions and try again.',
    success: 'Branding updated.',
  },
  domains: {
    empty: 'No custom domains connected.',
    error: 'Domain update failed. Please verify DNS settings.',
    success: 'Domain settings saved.',
  },
  sso: {
    empty: 'SSO is disabled for this tenant.',
    error: "SSO configuration couldn’t be saved. Check values and permissions.",
    success: 'SSO policy updated.',
  },
  storage: {
    empty: 'No storage backend configured.',
    error: "Storage settings couldn’t be saved. Confirm endpoint details.",
    success: 'Storage settings saved.',
  },
  capture: {
    empty: 'No default capture settings defined.',
    error: 'Failed to update capture defaults.',
    success: 'Capture defaults saved.',
  },
  permissions: {
    empty: 'No permissions model configured.',
    error: 'Permissions model update failed.',
    success: 'Permissions model saved.',
  },
  audit: {
    empty: 'No recent settings changes.',
    error: 'Couldn’t load audit log.',
  },
};

export default function TenantSettingsPage() {
  const [tab, setTab] = useState(0);
  return (
    <section className="max-w-2xl mx-auto py-8">
      <div className="flex border-b mb-4">
        {tabs.map((label, idx) => (
          <button
            key={label}
            className={`px-4 py-2 ${tab === idx ? 'border-b-2 border-blue-600' : ''}`}
            onClick={() => setTab(idx)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 0 && (
        <div>
          <label className="block mb-1">Tenant Name</label>
          <label className="block mb-1">Logo</label>
          <label className="block mb-1">Theme</label>
          <button className="mt-2 px-4 py-2 bg-blue-600 text-white">Save Changes</button>
          <p className="text-gray-500 mt-4">{copy.general.empty}</p>
        </div>
      )}
      {tab === 1 && (
        <div>
          <label className="block mb-1">Default Subdomain</label>
          <label className="block mb-1">Custom Domains</label>
          <p className="text-gray-500 mt-4">{copy.domains.empty}</p>
        </div>
      )}
      {tab === 2 && (
        <div>
          <label className="block mb-1">Enable SSO</label>
          <label className="block mb-1">Allowed Domains</label>
          <label className="block mb-1">Enforce Google-only Sign-in</label>
          <p className="text-gray-500 mt-4">{copy.sso.empty}</p>
        </div>
      )}
      {tab === 3 && (
        <div>
          <label className="block mb-1">Endpoint</label>
          <label className="block mb-1">Bucket</label>
          <p className="text-gray-500 mt-4">{copy.storage.empty}</p>
        </div>
      )}
      {tab === 4 && (
        <div>
          <label className="block mb-1">Frame Rate (fps)</label>
          <label className="block mb-1">Codec</label>
          <label className="block mb-1">Overlay Profile</label>
          <p className="text-gray-500 mt-4">{copy.capture.empty}</p>
        </div>
      )}
      {tab === 5 && (
        <div>
          <label className="block mb-1">RBAC Scheme</label>
          <label className="block mb-1">Policy Preview</label>
          <p className="text-gray-500 mt-4">{copy.permissions.empty}</p>
        </div>
      )}
      {tab === 6 && (
        <div>
          <p className="text-gray-500">{copy.audit.empty}</p>
        </div>
      )}
    </section>
  );
}

