import assert from 'node:assert';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useIsClient } from '../useIsClient';

// Example: node --test src/hooks/__tests__/useIsClient.test.tsx

test('returns false during server render', () => {
  function Comp() {
    const isClient = useIsClient();
    return <span>{String(isClient)}</span>;
  }
  const html = renderToString(<Comp />);
  assert.equal(html, '<span>false</span>');
});
