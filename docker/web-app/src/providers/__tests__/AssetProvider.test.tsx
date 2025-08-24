import assert from 'node:assert';
import test, { mock } from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AssetProvider, { useAssets } from '../AssetProvider';
import * as apiAssets from '../../lib/apiAssets';

// ensure components using useAssets render without error
function Show() {
  useAssets();
  return <span>ok</span>;
}

test('useAssets hook renders inside AssetProvider', () => {
  const assetsMock = mock.method(apiAssets, 'listAssets', async () => []);
  const foldersMock = mock.method(apiAssets, 'listFolders', async () => []);

  const qc = new QueryClient();

  assert.doesNotThrow(() =>
    renderToString(
      <QueryClientProvider client={qc}>
        <AssetProvider>
          <Show />
        </AssetProvider>
      </QueryClientProvider>
    )
  );

  assetsMock.mock.restore();
  foldersMock.mock.restore();
});
