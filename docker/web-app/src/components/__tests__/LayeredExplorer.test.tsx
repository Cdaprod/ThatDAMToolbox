import assert from 'node:assert';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import LayeredExplorer from '../LayeredFS/LayeredExplorer';
import { AssetCtx } from '../../providers/AssetProvider';

test('LayeredExplorer renders canvas', () => {
  const mockCtx = {
    assets: [],
    folders: [],
    foldersLoading: false,
    view: [],
    filters: {},
    setFilters: () => {},
    vectorSearch: async () => [],
    move: async () => {},
    remove: async () => {},
    refresh: () => {},
  } as any;

  const html = renderToString(
    <AssetCtx.Provider value={mockCtx}>
      <LayeredExplorer />
    </AssetCtx.Provider>
  );
  assert.ok(html.includes('<canvas'));
});
