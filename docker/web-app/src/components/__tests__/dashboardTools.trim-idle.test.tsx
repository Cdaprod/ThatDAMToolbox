import assert from 'node:assert';
import test from 'node:test';
import { dashboardTools } from '../dashboardTools';

test('includes trim-idle tool with correct href', () => {
  const tool = dashboardTools['trim-idle'];
  assert.ok(tool, 'trim-idle tool missing');
  assert.equal(tool.href, '/dashboard/trim-idle');
});
