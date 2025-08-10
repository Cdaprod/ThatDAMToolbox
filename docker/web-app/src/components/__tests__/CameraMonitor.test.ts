import test from 'node:test'
import assert from 'node:assert'
import { mergeDeviceIds } from '../CameraMonitor'

test('mergeDeviceIds handles non-array previous values', () => {
  const result = mergeDeviceIds({ foo: 'bar' } as any, ['a', 'b'])
  assert.deepEqual(result, ['a', 'b'])
})

test('mergeDeviceIds deduplicates device ids', () => {
  const result = mergeDeviceIds(['a'], ['a', 'b'])
  assert.deepEqual(result.sort(), ['a', 'b'])
})
