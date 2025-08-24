import test from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToString } from 'react-dom/server';

import QueryProvider from '../QueryProvider';

// Example: node --test src/providers/__tests__/QueryProvider.test.tsx

test('QueryProvider renders children', () => {
  const html = renderToString(
    <QueryProvider>
      <div id="child">hello</div>
    </QueryProvider>
  );
  assert.ok(html.includes('hello'));
});
