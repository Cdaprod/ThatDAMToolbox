// /docker/web-app/src/app/[tenant]/dashboard/access/page.tsx
// Displays membership list from api-gateway for access control.
import { apiGateway } from '../../../../lib/api';

export const metadata = { title: 'Access Control • That DAM Toolbox' };

export default async function AccessPage() {
  try {
    const members = await apiGateway.credentials();
    return (
      <section>
        <h1 className="text-2xl font-semibold mb-4">Access Control</h1>
        <button className="px-3 py-1 border rounded mb-4">Invite Member</button>
        {Array.isArray(members) && members.length > 0 ? (
          <table className="w-full text-left border">
            <thead>
              <tr>
                <th className="p-2 border-b">Member</th>
                <th className="p-2 border-b">Roles</th>
                <th className="p-2 border-b">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: any, idx: number) => (
                <tr key={m.id ?? idx} className="border-b">
                  <td className="p-2">{m.user || m.name || m.id}</td>
                  <td className="p-2">{m.role || '-'}</td>
                  <td className="p-2">{m.lastActive || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500">No members in this tenant yet.</p>
        )}

        <div className="mt-8">
          <h2 className="font-medium mb-2">Test SSO Rules</h2>
          <input
            type="email"
            placeholder="user@example.com"
            className="border p-1 mr-2"
          />
          <button className="px-3 py-1 border rounded">Check Email</button>
        </div>

        <div className="mt-8">
          <h2 className="font-medium mb-2">Access Changes</h2>
          <p className="text-gray-500">No recent access changes.</p>
        </div>
      </section>
    );
  } catch {
    return (
      <section>
        <h1 className="text-2xl font-semibold mb-4">Access Control</h1>
        <p className="text-red-500">Unable to fetch members. Please refresh.</p>
      </section>
    );
  }
}
