import test from 'node:test';
import assert from 'node:assert';
import { renderToString } from 'react-dom/server';
import NodesPage from '../nodes/page';
import { supervisor } from '../../../../lib/api';

test('shows fallback message when supervisor unreachable', async () => {
  const original = supervisor.listNodes;
  supervisor.listNodes = async () => {
    throw new Error('fail');
  };
  try {
    const html = renderToString(await NodesPage());
    assert.ok(html.includes('Supervisor unreachable'));
  } finally {
    supervisor.listNodes = original;
  }
});

test('renders node names when supervisor returns list', async () => {
  const original = supervisor.listNodes;
  supervisor.listNodes = async () => [{ id: 'n1', name: 'cam1' }];
  try {
    const html = renderToString(await NodesPage());
    assert.ok(html.includes('cam1'));
  } finally {
    supervisor.listNodes = original;
  }
});
