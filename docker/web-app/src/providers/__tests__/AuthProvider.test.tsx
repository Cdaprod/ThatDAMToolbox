import assert from 'node:assert';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AuthProvider, { useAuth } from '../AuthProvider';
import path from 'node:path';

const cookieClientPath = path.resolve(
  __dirname,
  '../../lib/tenancy/cookieClient.js'
);
const cookieClientMod = require(cookieClientPath);

(global as any).__nextAuthReact = {
  signIn: async () => {},
  signOut: async () => { (global as any).__signOutCalled = true; },
  useSession: () => ({ status: 'authenticated', data: null }),
};
(global as any).__nextNavigation = {
  redirect: () => {},
  useRouter: () => ({ replace: () => {} }),
  usePathname: () => '/',
  useParams: () => ({}),
};

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

test('login sets default tenant cookie', () => {
  let called: string | null = null;
  cookieClientMod.setDefaultTenantCookie = async (slug: string) => {
    called = slug;
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

  assert.equal(called, 'tenant1');
});

test('logout clears default tenant cookie', () => {
  let cleared = false;
  cookieClientMod.clearDefaultTenantCookie = async () => {
    cleared = true;
  };

  let ctx: ReturnType<typeof useAuth> | undefined;
  function Capture() {
    ctx = useAuth();
    return null;
  }

  renderToString(
    <AuthProvider initialToken="tkn">
      <Capture />
    </AuthProvider>,
  );

  ctx?.logout();

  assert.ok(cleared);
});

test('tenantId initializes from cookie', () => {
  (global as any).document = { cookie: 'cda_tenant=acme' };
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

  assert.equal(ctx?.tenantId, 'acme');
  delete (global as any).document;
});

test('logout invokes next-auth signOut', () => {
  let ctx: ReturnType<typeof useAuth> | undefined;
  function Capture() {
    ctx = useAuth();
    return null;
  }
  (global as any).__signOutCalled = false;
  renderToString(
    <AuthProvider initialToken="tkn">
      <Capture />
    </AuthProvider>
  );
  ctx?.logout();
  assert.ok((global as any).__signOutCalled);
});
