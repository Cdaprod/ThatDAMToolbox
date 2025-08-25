/**
 * getTimeZones fallback test.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { getTimeZones } from '../timezones';

test('getTimeZones returns fallback list when Intl.supportedValuesOf is missing', () => {
  const original = (Intl as any).supportedValuesOf;
  // Ensure the method is absent to trigger fallback
  delete (Intl as any).supportedValuesOf;
  const zones = getTimeZones();
  assert.ok(zones.includes('UTC'));
  // Restore if it existed
  if (original) (Intl as any).supportedValuesOf = original;
});
