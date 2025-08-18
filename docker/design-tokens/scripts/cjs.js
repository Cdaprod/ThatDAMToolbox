/**
 * Generate a CommonJS wrapper for the ESM build output.
 * Usage: node scripts/cjs.js
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const es = readFileSync(path.join(__dirname, '../dist/index.js'), 'utf8');
const cjs = es
  .replaceAll('export const ', 'exports.')
  .replace('export { tokens };', 'module.exports = { tokens };');
writeFileSync(path.join(__dirname, '../dist/index.cjs'), cjs);
