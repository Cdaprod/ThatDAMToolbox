import test from 'node:test'
import assert from 'node:assert'
import {
  Asset,
  filterAssets,
  performVectorSearch,
  findAssetById,
  confirmDeletion,
  StatusMessage,
} from '../DAMExplorer/helpers'

test('filters assets by query and tags', () => {
  const assets: Asset[] = [
    { id: '1', name: 'Cat', tags: ['animal'], size: 1000, kind: 'image', createdAt: '', updatedAt: '', path: '', meta: {} },
    { id: '2', name: 'Dog', tags: ['animal', 'pet'], size: 1000, kind: 'image', createdAt: '', updatedAt: '', path: '', meta: {} },
  ]
  const results = filterAssets(assets, 'dog')
  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].id, '2')
})

test('performVectorSearch maps results and bubbles errors', async () => {
  const assets: Asset[] = [
    { id: '1', name: 'Cat', tags: ['animal'], size: 1000, kind: 'image', createdAt: '', updatedAt: '', path: '', meta: {} },
  ]
  let status: StatusMessage | null = null
  const show = (m: string, type: StatusMessage['type'] = 'info') => {
    status = { message: m, type }
  }
  const hits = await performVectorSearch('cat', async () => assets, show)
  assert.strictEqual(hits[0].id, '1')
  assert.strictEqual(status, null)

  await performVectorSearch('err', async () => { throw new Error('fail') }, show)
  assert.ok(status)
  const s = status as StatusMessage
  assert.strictEqual(s.type, 'error')
})

test('findAssetById returns matching asset', () => {
  const assets: Asset[] = [
    { id: '1', name: 'Cat', tags: [], size: 0, kind: 'image', createdAt: '', updatedAt: '', path: '', meta: {} },
  ]
  const found = findAssetById(assets, '1')
  assert.ok(found)
  assert.strictEqual(found?.name, 'Cat')
})

test('confirmDeletion respects user choice', async () => {
  const removed: string[][] = []
  const removeFn = async (ids: string[]) => { removed.push(ids) }
  const confirmed = await confirmDeletion(['1'], removeFn, () => true)
  assert.ok(confirmed)
  assert.deepStrictEqual(removed[0], ['1'])

  const notConfirmed = await confirmDeletion(['2'], removeFn, () => false)
  assert.strictEqual(notConfirmed, false)
  assert.strictEqual(removed.length, 1)
})

