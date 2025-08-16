import assert from 'node:assert';
import test from 'node:test';
import { dashboardTools } from '../dashboardTools';

test('includes nodes tool with correct href', () => {
  const tool = dashboardTools['nodes'];
  assert.ok(tool, 'nodes tool missing');
  assert.equal(tool.href, '/dashboard/nodes');
});
