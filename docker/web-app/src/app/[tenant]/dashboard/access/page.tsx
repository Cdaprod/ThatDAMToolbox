// /docker/web-app/src/app/[tenant]/dashboard/access/page.tsx
// Displays credential list from api-gateway for access control.
import { apiGateway } from '../../../../lib/api'

export const metadata = { title: 'Access Control • That DAM Toolbox' }

export default async function AccessPage() {
  try {
    const creds = await apiGateway.credentials()
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-4">Access Control</h1>
        {Array.isArray(creds) && creds.length > 0 ? (
          <ul className="space-y-2">
            {creds.map((c: any, idx: number) => (
              <li key={c.id ?? idx} className="p-2 border rounded">
                {c.name || c.id || JSON.stringify(c)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No credentials found</p>
        )}
      </div>
    )
  } catch {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-4">Access Control</h1>
        <p className="text-red-500">Access service unreachable</p>
      </div>
    )
  }
}
