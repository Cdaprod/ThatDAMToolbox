import test from 'node:test'
import assert from 'node:assert'
import { renderToString } from 'react-dom/server'
import HeroVideo from './hero-video.js'
import AmbientGrid from './ambient-grid.js'

test('HeroVideo includes video element', () => {
  const html = renderToString(<HeroVideo />)
  assert.ok(html.includes('<video'))
})

test('AmbientGrid renders fixed backdrop', () => {
  const html = renderToString(<AmbientGrid />)
  assert.ok(html.includes('position:fixed'))
})
