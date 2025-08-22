import test from 'node:test'
import assert from 'node:assert'
import { fitRect } from '../fitRect'

test('fits width when container narrower than media', () => {
  const box = fitRect({ width: 100, height: 100 }, { width: 200, height: 100 })
  assert.deepStrictEqual(box, { width: 100, height: 50 })
})

test('fits height when container taller than media', () => {
  const box = fitRect({ width: 200, height: 100 }, { width: 100, height: 200 })
  assert.deepStrictEqual(box, { width: 50, height: 100 })
})

test('returns zero when any dimension missing', () => {
  const box = fitRect({ width: 0, height: 100 }, { width: 100, height: 50 })
  assert.deepStrictEqual(box, { width: 0, height: 0 })
})
