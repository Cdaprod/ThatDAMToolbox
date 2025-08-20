import test from 'node:test'
import assert from 'node:assert'
import { deriveThemeId } from '../ThemeContext'

test('handles tenant-prefixed paths', () => {
  assert.strictEqual(deriveThemeId('/tenant/dam-explorer'), 'dam-explorer')
})

test('falls back to camera-monitor when unknown', () => {
  assert.strictEqual(deriveThemeId('/tenant/unknown'), 'camera-monitor')
})
