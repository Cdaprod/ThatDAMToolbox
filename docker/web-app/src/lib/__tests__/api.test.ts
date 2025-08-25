import assert from 'node:assert';
import test from 'node:test';
import {
  supervisor,
  captureDaemon,
  mediaApi,
  apiGateway,
  observability,
  brokerTopics,
  setAuthToken,
} from '../api';
import { apiUrl } from '../networkConfig';

// simple fetch spy to capture URLs and options
const calls: { url: string; init?: any }[] = [];
(globalThis as any).fetch = (url: string, init?: any) => {
  calls.push({ url: url as string, init });
  return Promise.resolve({ ok: true, json: async () => ({}) });
};

test('supervisor.listNodes hits /v1/nodes', async () => {
  calls.length = 0;
  await supervisor.listNodes();
  assert.ok(calls[0].url.includes('/v1/nodes'));
});

test('captureDaemon.listDevices hits /hwcapture/devices', async () => {
  calls.length = 0;
  await captureDaemon.listDevices();
  assert.ok(calls[0].url.includes('/hwcapture/devices'));
});

test('mediaApi.listJobs hits /v1/jobs', async () => {
  calls.length = 0;
  await mediaApi.listJobs();
  assert.ok(calls[0].url.includes('/v1/jobs'));
});

test('apiGateway.credentials hits /credentials', async () => {
  calls.length = 0;
  await apiGateway.credentials();
  assert.ok(calls[0].url.includes('/credentials'));
});

test('observability.health hits /service/health', async () => {
  calls.length = 0;
  await observability.health('svc');
  assert.ok(calls[0].url.includes('/svc/health'));
});

test('broker topics defined', () => {
  assert.ok(brokerTopics.includes('overlay.*'));
});

test('auth token attaches Authorization header', async () => {
  calls.length = 0;
  setAuthToken('secret');
  await supervisor.listNodes();
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret');
});

test('apiUrl honors API_BASE_URL on server', () => {
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  process.env.API_BASE_URL = 'https://api.example.com';
  const url = apiUrl('/foo');
  assert.equal(url, 'https://api.example.com/foo');
});
