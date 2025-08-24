import assert from 'node:assert';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useMediaQuery } from '../useMediaQuery';

// Example: node --test src/hooks/__tests__/useMediaQuery.test.tsx

test('uses ssrMatch on server render', () => {
  function Comp() {
    const match = useMediaQuery('(max-width: 600px)', true);
    return <span>{match ? 'yes' : 'no'}</span>;
  }
  const html = renderToString(<Comp />);
  assert.equal(html, '<span>yes</span>');
});
