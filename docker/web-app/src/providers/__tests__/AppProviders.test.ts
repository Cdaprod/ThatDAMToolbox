/**
 * Validate AppProviders wires ThemeContext's ThemeProvider so themes change colors.
 *
 * Example:
 *   npm test
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

test('AppProviders imports ThemeContext provider', () => {
  const src = readFileSync(join(process.cwd(), 'src/providers/AppProviders.tsx'), 'utf8');
  assert.match(src, /from '@\/context\/ThemeContext'/);
});
