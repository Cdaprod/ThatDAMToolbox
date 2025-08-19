import assert from 'node:assert';
import test from 'node:test';
import { getPresignedGet } from '../minio';

test('getPresignedGet returns URL with key and expiry', async () => {
  const url = await getPresignedGet('file.txt', { expiresSeconds: 60 });
  assert.ok(url.includes('file.txt'));
  assert.ok(url.includes('expires=60'));
});
