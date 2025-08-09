/**
 * Tests for sendMail helper.
 *
 * Run:
 *   node --test src/lib/sendMail.test.js
 */
const test = require('node:test')
const assert = require('node:assert/strict')

const { sendMail } = require('./sendMail')

test('returns false when config missing', async () => {
  const ok = await sendMail({ name: 'A', email: 'a@b.com', message: 'hi' })
  assert.equal(ok, false)
})
