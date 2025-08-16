// /docker/web-app/src/app/[tenant]/dashboard/nodes/page.tsx
// Displays a list of registered nodes from Supervisor.
import { supervisor } from '@/lib/api';

export const metadata = { title: 'Nodes • That DAM Toolbox' };

export default async function NodesPage() {
  const nodes = await supervisor.listNodes();
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Nodes</h1>
      <ul className="space-y-2">
        {nodes.map((node: any, idx: number) => (
          <li key={node.id ?? idx} className="p-2 border rounded">
            {node.name || node.id || JSON.stringify(node)}
          </li>
        ))}
      </ul>
    </div>
  );
}
