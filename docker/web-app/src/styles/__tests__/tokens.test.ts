import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert'

const css = fs.readFileSync(path.join(process.cwd(), 'src/styles/tokens.css'), 'utf8')

test('defines fluid type scale', () => {
  assert.match(css, /--fs-sm: clamp/)
  assert.match(css, /--fs-xl: clamp/)
})

test('defines fluid spacing scale', () => {
  assert.match(css, /--space-sm: clamp/)
  assert.match(css, /--space-lg: clamp/)
})
