import assert from 'node:assert'
import test from 'node:test'
import { consolidateKept, prettyDuration } from '../edl'

test('consolidateKept merges overlapping ranges', () => {
  const merged = consolidateKept([
    { start: 0, end: 1 },
    { start: 0.9, end: 2 },
    { start: 3, end: 4 },
  ])
  assert.deepEqual(merged, [
    { start: 0, end: 2 },
    { start: 3, end: 4 },
  ])
})

test('prettyDuration formats seconds', () => {
  assert.equal(prettyDuration(65.4321), '01:05.432')
})
