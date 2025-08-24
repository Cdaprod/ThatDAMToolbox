import React from 'react';
import test from 'node:test';
import assert from 'node:assert';
import { renderToString } from 'react-dom/server';

// Dashboard pages should redirect unauthenticated users to the login screen.
test('dashboard page redirects unauthenticated users to login', async () => {
  let redirected = '';
  (global as any).__nextNavigation = {
    redirect: () => {},
    useRouter: () => ({ replace: (url: string) => { redirected = url; } }),
    usePathname: () => '/acme/dashboard',
    useParams: () => ({ tenant: 'acme' }),
  };
  (global as any).__nextAuthReact = {
    signIn: async () => {},
    useSession: () => ({ status: 'unauthenticated', data: null }),
  };

  const req = require as any;
  const AuthProvider = req('../../providers/AuthProvider.js').default;
  const Dashboard = () => <div>dashboard</div>;

  renderToString(
    <AuthProvider>
      <Dashboard />
    </AuthProvider>,
  );
  assert.equal(redirected, '/login?redirect=%2Facme%2Fdashboard');
});
