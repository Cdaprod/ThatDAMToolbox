import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { selectionStore } from './selection'

test('toggle adds and removes ids', () => {
  selectionStore.toggle('a')
  assert.ok(selectionStore.ids.has('a'))
  selectionStore.toggle('a')
  assert.ok(!selectionStore.ids.has('a'))
  selectionStore.clear()
})

test('clear removes all ids', () => {
  selectionStore.toggle('a')
  selectionStore.toggle('b')
  selectionStore.clear()
  assert.equal(selectionStore.ids.size, 0)
})
