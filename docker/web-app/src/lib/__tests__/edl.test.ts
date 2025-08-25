import assert from 'node:assert'
import test from 'node:test'
import { consolidateKept, prettyDuration } from '../edl'
import { edlToSequence } from '../media/edl'
import type { SimpleEDL } from '../media/types'

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

test('edlToSequence produces sequence clips', () => {
  const edl: SimpleEDL = {
    version: 'trimidle.v1',
    sourceName: 'demo.mp4',
    duration: 10,
    kept: [{ start: 0, end: 2 }, { start: 4, end: 6 }],
  }
  const seq = edlToSequence(edl, 'asset1')
  assert.equal(seq.tracks[0].clips.length, 2)
  assert.equal(seq.tracks[0].clips[0].source.start, 0)
})
