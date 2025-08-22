/**
 * Ensures every UI/UX task stub exists and throws "Not implemented".
 *
 * Run with: npm test
 */
import test from 'node:test'
import assert from 'node:assert'
import { uiUxTasks, taskNames } from '../uiUxTasks'

test('UI/UX task stubs throw not implemented', () => {
  for (const name of taskNames) {
    const fn = uiUxTasks[name]
    assert.strictEqual(typeof fn, 'function', `${name} should be a function`)
    assert.throws(() => fn(), /Not implemented/)
  }
})

