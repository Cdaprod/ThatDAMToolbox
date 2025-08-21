import test from 'node:test';
import assert from 'node:assert';
import { renderToString } from 'react-dom/server';
import MotionPage from '../motion/page';
import { motionExtractor } from '../../../../lib/api';

test('motion page snapshot', async () => {
  const original = motionExtractor.jobs;
  motionExtractor.jobs = async () => [{ id: '1', status: 'done' }];
  try {
    const html = renderToString(await MotionPage());
    assert.equal(
      html,
      '<div><h1 class="text-2xl font-semibold mb-4">Motion Extractor Jobs</h1><ul class="space-y-2"><li class="p-2 border rounded">done</li></ul></div>'
    );
  } finally {
    motionExtractor.jobs = original;
  }
});
