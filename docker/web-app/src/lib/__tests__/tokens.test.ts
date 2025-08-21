/**
 * Basic check that design color tokens are present.
 *
 * Example:
 *   npm test
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const TOKENS_PATH = join(process.cwd(), 'src/styles/tokens.css');

test('tokens.css exposes required color variables', () => {
  const css = readFileSync(TOKENS_PATH, 'utf8');
  assert.match(css, /--color-primary-500:/);
  assert.match(css, /--color-success-500:/);
  assert.match(css, /\[data-theme='dark'\]/);
  assert.match(css, /\[data-theme='sepia'\]/);
  assert.match(css, /\[data-theme='royal'\]/);
});

