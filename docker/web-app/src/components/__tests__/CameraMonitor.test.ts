import test from 'node:test'
import assert from 'node:assert'
import { mergeDeviceIds, toCssAspect } from '../CameraMonitor/utils'

test('mergeDeviceIds handles non-array previous values', () => {
  const result = mergeDeviceIds({ foo: 'bar' } as any, ['a', 'b'])
  assert.deepEqual(result, ['a', 'b'])
})

test('mergeDeviceIds deduplicates device ids', () => {
  const result = mergeDeviceIds(['a'], ['a', 'b'])
  assert.deepEqual(result.sort(), ['a', 'b'])
})

test('mergeDeviceIds merges new ids when list was empty', () => {
  const result = mergeDeviceIds([], ['x'])
  assert.deepEqual(result, ['x'])
})

test('mergeDeviceIds is idempotent when merging same list', () => {
  const first = mergeDeviceIds([], ['a', 'b'])
  const second = mergeDeviceIds(first, ['a', 'b'])
  assert.deepEqual(second.sort(), ['a', 'b'])
})

test('toCssAspect returns fallback when aspect missing', () => {
  assert.equal(toCssAspect(null), '16 / 9')
})

test('toCssAspect converts numeric aspect to string', () => {
  assert.equal(toCssAspect(4 / 3), `${4 / 3}`)
})
