const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

test('HeroVideo component includes video element', () => {
  const file = path.join(__dirname, 'HeroVideo.tsx')
  const content = fs.readFileSync(file, 'utf8')
  assert.ok(content.includes('<video'))
})

