import test from 'node:test'
import assert from 'node:assert'
import { deriveThemeId } from '../ThemeContext'

test('deriveThemeId returns default for any path', () => {
  assert.strictEqual(deriveThemeId('/tenant/dam-explorer'), 'default')
  assert.strictEqual(deriveThemeId('/tenant/unknown'), 'default')
})
