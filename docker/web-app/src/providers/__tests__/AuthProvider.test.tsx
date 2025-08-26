import assert from 'node:assert';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AuthProvider, { useAuth } from '../AuthProvider';

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

test('login stores tenantId in sessionStorage', async () => {
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

  await ctx?.login('tkn', { name: 'A' }, 'tenant1');

  assert.equal((global as any).sessionStorage.getItem('tenantId'), 'tenant1');
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

test('production login fetches tenant and persists slug', async () => {
  const oldEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = 'production';
  process.env.NEXT_PUBLIC_TENANCY_URL = 'http://tenancy.local';

  const fetchCalls: any[] = [];
  (global as any).fetch = async (url: string, init?: any) => {
    fetchCalls.push({ url, init });
    if (url === 'http://tenancy.local/login') {
      return { ok: true, json: async () => ({ slug: 'sluggy' }) } as any;
    }
    if (url === '/api/account/set-default-tenant') {
      return { ok: true, json: async () => ({}) } as any;
    }
    return { ok: false } as any;
  };

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

  const payload = Buffer.from(JSON.stringify({ sub: 'user1' })).toString('base64url');
  await ctx?.login(`x.${payload}.y`);

  assert.equal((global as any).sessionStorage.getItem('tenantId'), 'sluggy');
  assert.ok(
    fetchCalls.some((c) =>
      c.url === '/api/account/set-default-tenant' && c.init?.body?.includes('sluggy'),
    ),
  );

  (process.env as any).NODE_ENV = oldEnv;
});
