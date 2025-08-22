import assert from 'node:assert';
import test from 'node:test';
import { ensureTenant, getTenantSettings, setTenantSettings, listAudit } from '../settingsDB';

// Basic smoke tests for in-memory tenant store.

test('ensureTenant seeds defaults', () => {
  ensureTenant('demo');
  const settings = getTenantSettings('demo');
  assert.equal(settings.branding.tenantName, 'demo');
});

test('setTenantSettings updates section and audits', () => {
  ensureTenant('demo2');
  setTenantSettings('demo2', 'branding', { tenantName: 'Demo 2', logoUrl: '', theme: 'light' }, 'tester');
  const updated = getTenantSettings('demo2');
  assert.equal(updated.branding.tenantName, 'Demo 2');
  const audits = listAudit('demo2');
  assert.equal(audits[0].kind, 'update');
});

