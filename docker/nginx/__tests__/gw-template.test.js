/**
 * Basic sanity check for gateway Nginx template.
 *
 * Usage:
 *   node --test docker/nginx/__tests__/gw-template.test.js
 */
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert'

const tpl = readFileSync(new URL('../templates/gw.tmpl', import.meta.url), 'utf8')

test('gateway template routes API and web app', () => {
  assert.ok(tpl.includes('upstream api_backend'))
  assert.ok(tpl.includes('upstream web_frontend'))
  assert.ok(tpl.includes('location /api/'))
  assert.ok(tpl.includes('proxy_pass http://api_backend'))
  assert.ok(tpl.includes('location / {'))
  assert.ok(tpl.includes('proxy_pass http://web_frontend'))
})
