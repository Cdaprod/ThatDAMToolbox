import test from 'node:test'
import assert from 'node:assert'
import { getStatusColor } from '../DAMExplorer/AssetThumbnail'

test('getStatusColor maps statuses', () => {
  assert.equal(getStatusColor('processed'), 'status-success')
})
