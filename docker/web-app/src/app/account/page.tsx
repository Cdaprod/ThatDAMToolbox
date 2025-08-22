// /docker/web-app/src/app/account/page.tsx
// Placeholder for user account settings.
'use client';

export default function AccountPage() {
  return (
    <section className="max-w-md mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Account</h1>

      <h2 className="text-xl font-semibold mt-6 mb-2">Profile</h2>
      <label className="block mb-1">Name</label>
      <label className="block mb-1">Avatar</label>
      <label className="block mb-1">Time Zone</label>

      <h2 className="text-xl font-semibold mt-6 mb-2">Security</h2>
      <label className="block mb-1">Multi-Factor Authentication</label>
      <button className="px-3 py-1 border rounded mb-2">Enable MFA</button>
      <label className="block mb-1">Recovery Factors</label>

      <h2 className="text-xl font-semibold mt-6 mb-2">Connected Identities</h2>
      <p className="mb-2">Google Account: Not connected</p>
      <button className="px-3 py-1 border rounded mb-2">Disconnect Google</button>

      <h2 className="text-xl font-semibold mt-6 mb-2">Default Tenant</h2>
      <label className="block mb-1">Preferred Tenant</label>
    </section>
  );
}

