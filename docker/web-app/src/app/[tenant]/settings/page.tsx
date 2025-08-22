// /docker/web-app/src/app/[tenant]/settings/page.tsx
// Tenant-scoped settings hub.
'use client';

import { useState } from 'react';

const tabs = ['General', 'SSO', 'Storage', 'Capture', 'Permissions'];

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
      {tab === 0 && <p />}
      {tab === 1 && <p />}
      {tab === 2 && <p />}
      {tab === 3 && <p />}
      {tab === 4 && <p />}
    </section>
  );
}

