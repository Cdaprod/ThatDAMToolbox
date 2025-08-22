/**
 * Access control page render tests.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import AccessPage from '../access/page';
import { apiGateway } from '../../../../lib/api';

test('shows fallback when service unreachable', async () => {
  const original = apiGateway.credentials;
  apiGateway.credentials = async () => {
    throw new Error('fail');
  };
  try {
    const html = renderToString(await AccessPage());
    assert.ok(html.includes('Unable to fetch members'));
  } finally {
    apiGateway.credentials = original;
  }
});

test('shows empty state when no members', async () => {
  const original = apiGateway.credentials;
  apiGateway.credentials = async () => [];
  try {
    const html = renderToString(await AccessPage());
    assert.ok(html.includes('No members in this tenant yet.'));
  } finally {
    apiGateway.credentials = original;
  }
});
