/**
 * SignupPage renders initial sign-up form.
 * Run with: npm test
 */
import assert from 'node:assert';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import SignupPage from '../signup/page';
import AuthProvider from '../../providers/AuthProvider';

test('SignupPage shows form inputs', () => {
  const html = renderToStaticMarkup(
    <AuthProvider>
      <SignupPage router={{ push: () => {} }} />
    </AuthProvider>,
  );
  assert.ok(html.includes('Sign Up'));
  assert.ok(html.includes('<form'));
});

