import assert from 'node:assert';
import test from 'node:test';
import { layeredLayout } from '../LayeredFS/layout';
import type { TreeSnapshot } from '../LayeredFS/types';

test('layeredLayout positions children by depth', () => {
  const snapshot: TreeSnapshot = {
    nodes: {
      root: { id: 'root', name: '/', path: '/', depth: 0, kind: 'folder', childIds: ['file1'] },
      file1: { id: 'file1', name: 'file', path: '/', depth: 1, kind: 'file', parentId: 'root' },
    },
    rootId: 'root',
  };
  const layout = layeredLayout(snapshot);
  assert.equal(layout.items['root'].z, 0);
  assert.equal(layout.items['file1'].z, -3);
  assert.ok(layout.edges.find(e => e.from === 'root' && e.to === 'file1'));
});
