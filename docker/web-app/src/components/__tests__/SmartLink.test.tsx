import assert from 'node:assert'
import test from 'node:test'
import SmartLink from '../SmartLink'

// SmartLink should disable prefetch by default

test('SmartLink defaults to prefetch=false', () => {
  const el = SmartLink({ href: '/foo', children: 'foo' }) as any
  assert.equal(el.props.prefetch, false)
})

test('SmartLink allows prefetch override', () => {
  const el = SmartLink({ href: '/bar', prefetch: true, children: 'bar' }) as any
  assert.equal(el.props.prefetch, true)
})

