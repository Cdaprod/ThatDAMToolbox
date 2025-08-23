import test from 'node:test'
import assert from 'node:assert'
import { renderToString } from 'react-dom/server'
import SmartLink from './smart-link.js'
import { Shimmer } from './skeletons.js'

test('SmartLink defaults to prefetch=false', () => {
  const el = SmartLink({ href: '/foo', children: 'foo' }) as any
  assert.equal(el.props.prefetch, false)
})

test('Shimmer renders container', () => {
  const html = renderToString(<Shimmer style={{ width: 10 }} />)
  assert.ok(html.includes('background'))
})
