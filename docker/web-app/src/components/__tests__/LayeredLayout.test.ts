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

test('layeredLayout respects column option for responsiveness', () => {
  const snapshot: TreeSnapshot = {
    nodes: {
      root: { id: 'root', name: '/', path: '/', depth: 0, kind: 'folder', childIds: ['a', 'b', 'c'] },
      a: { id: 'a', name: 'a', path: '/', depth: 1, kind: 'file', parentId: 'root' },
      b: { id: 'b', name: 'b', path: '/', depth: 1, kind: 'file', parentId: 'root' },
      c: { id: 'c', name: 'c', path: '/', depth: 1, kind: 'file', parentId: 'root' },
    },
    rootId: 'root',
  };
  const layout = layeredLayout(snapshot, { cols: 2 });
  assert.notEqual(layout.items['c'].y, layout.items['a'].y);
});
