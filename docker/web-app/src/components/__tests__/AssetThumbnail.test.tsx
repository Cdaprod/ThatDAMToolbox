import test from 'node:test'
import assert from 'node:assert'
import { getStatusColor } from '../DAMExplorer/AssetThumbnail'

test('getStatusColor maps statuses', () => {
  assert.equal(getStatusColor('processed'), 'bg-green-100 text-green-800')
})
