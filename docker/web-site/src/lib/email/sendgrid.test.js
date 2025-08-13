/**
 * Tests for sendgrid email helpers.
 *
 * Run:
 *   node --test -r ts-node/register src/lib/email/sendgrid.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const sgMail = require('@sendgrid/mail');

const requiredVars = ['SENDGRID_API_KEY','SENDGRID_FROM_EMAIL','SENDGRID_FROM_NAME'];

function resetModule() {
  delete require.cache[require.resolve('./sendgrid.ts')];
}

test('throws when required env missing', async () => {
  for (const k of requiredVars) delete process.env[k];
  resetModule();
  assert.throws(() => require('./sendgrid.ts'));
});

test('sendPlainTextEmail sends message', async () => {
  process.env.SENDGRID_API_KEY = 'k';
  process.env.SENDGRID_FROM_EMAIL = 'a@example.com';
  process.env.SENDGRID_FROM_NAME = 'Tester';
  resetModule();
  const mod = require('./sendgrid.ts');
  let called = false;
  sgMail.send = async () => {
    called = true;
    return [{ statusCode: 202 }];
  };
  const res = await mod.sendPlainTextEmail({ to: 'b@example.com', subject: 's', text: 't' });
  assert.equal(res.statusCode, 202);
  assert.equal(called, true);
});
