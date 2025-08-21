import test from 'node:test'
import assert from 'node:assert'
import { deriveThemeId } from '../ThemeContext'

test('deriveThemeId returns light for any path', () => {
  assert.strictEqual(deriveThemeId('/tenant/dam-explorer'), 'light')
  assert.strictEqual(deriveThemeId('/tenant/unknown'), 'light')
})
