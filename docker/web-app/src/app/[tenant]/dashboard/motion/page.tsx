// /docker/web-app/src/app/[tenant]/dashboard/motion/page.tsx
// Lists motion extractor jobs and their statuses.
import { motionExtractor } from '../../../../lib/api';

export const metadata = { title: 'Motion • That DAM Toolbox' };

export default async function MotionPage() {
  try {
    const jobs = await motionExtractor.jobs();
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-4">Motion Extractor Jobs</h1>
        <ul className="space-y-2">
          {jobs.map((job: any, idx: number) => (
            <li key={job.id ?? idx} className="p-2 border rounded">
              {job.status || JSON.stringify(job)}
            </li>
          ))}
        </ul>
      </div>
    );
  } catch {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-4">Motion Extractor Jobs</h1>
        <p className="text-red-500">Unable to fetch job status</p>
      </div>
    );
  }
}
