import assert from 'node:assert'
import test from 'node:test'
import { dashboardTools } from '../dashboardTools'

test('includes access control tool with correct href', () => {
  const tool = dashboardTools['access']
  assert.ok(tool, 'access control tool missing')
  assert.equal(tool.href, '/dashboard/access')
})
