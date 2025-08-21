/**
 * Basic smoke test to ensure tokens bundle is accessible.
 *
 * Run:
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const cssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tokens.css');

test('exports grid unit token', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('--grid-unit'), 'grid unit token missing');
});
