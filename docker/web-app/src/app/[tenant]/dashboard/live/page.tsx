// /docker/web-app/src/app/[tenant]/dashboard/live/page.tsx
// Streams live video from a selected device or shows a fallback message.
import { apiUrl } from '../../../../lib/networkConfig';

export const metadata = { title: 'Live • That DAM Toolbox' };

export default function LivePage({ searchParams }: { searchParams: { device?: string } }) {
  const device = searchParams?.device;
  if (!device) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-4">Live Monitor</h1>
        <p className="text-gray-500">No device selected</p>
      </div>
    );
  }
  const src = apiUrl(`/live/${device}`);
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Live Monitor</h1>
      <img src={src} alt={`live feed ${device}`} />
    </div>
  );
}
