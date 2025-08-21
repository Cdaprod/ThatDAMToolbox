import assert from 'node:assert';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AuthProvider, { useAuth } from '../AuthProvider';

function ShowToken() {
  const { token } = useAuth();
  return <span>{token}</span>;
}

test('AuthProvider supplies initial token', () => {
  const html = renderToString(
    <AuthProvider initialToken="abc">
      <ShowToken />
    </AuthProvider>
  );
  assert.ok(html.includes('abc'));
});

test('login stores tenantId in sessionStorage', () => {
  (global as any).sessionStorage = {
    data: {} as Record<string, string>,
    setItem(k: string, v: string) {
      this.data[k] = v;
    },
    getItem(k: string) {
      return this.data[k];
    },
    removeItem(k: string) {
      delete this.data[k];
    },
  };

  let ctx: ReturnType<typeof useAuth> | undefined;
  function Capture() {
    ctx = useAuth();
    return null;
  }

  renderToString(
    <AuthProvider>
      <Capture />
    </AuthProvider>,
  );

  ctx?.login('tkn', { name: 'A' }, 'tenant1');

  assert.equal((global as any).sessionStorage.getItem('tenantId'), 'tenant1');
});
