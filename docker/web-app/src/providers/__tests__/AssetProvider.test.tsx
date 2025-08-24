import assert from 'node:assert';
import test, { mock } from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AssetProvider, { useAssets } from '../AssetProvider';

function ShowCount() {
  const { assets } = useAssets();
  return <span>{assets.length}</span>;
}

test('AssetProvider supplies assets context', async () => {
  const fetchMock = mock.method(global as any, 'fetch', async () =>
    new Response(JSON.stringify({ assetsList: [] }), { status: 200 }) as any
  );

  const qc = new QueryClient();
  const html = renderToString(
    <QueryClientProvider client={qc}>
      <AssetProvider>
        <ShowCount />
      </AssetProvider>
    </QueryClientProvider>
  );

  assert.ok(html.includes('0'));
  fetchMock.mock.restore();
});
