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
