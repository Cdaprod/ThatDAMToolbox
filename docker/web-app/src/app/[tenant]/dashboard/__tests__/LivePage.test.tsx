import test from 'node:test';
import assert from 'node:assert';
import { renderToString } from 'react-dom/server';
import LivePage from '../live/page';

test('live page snapshot with device', () => {
  const html = renderToString(
    LivePage({ searchParams: { device: 'cam1' } }) as any
  );
  assert.equal(
    html,
    '<div><h1 class="text-2xl font-semibold mb-4">Live Monitor</h1><img src="http://localhost:8080/live/cam1" alt="live feed cam1"/></div>'
  );
});

test('live page shows fallback when no device', () => {
  const html = renderToString(LivePage({ searchParams: {} }) as any);
  assert.ok(html.includes('No device selected'));
});
