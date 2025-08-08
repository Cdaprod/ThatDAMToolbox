import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import MotionExtract from '../tools/MotionExtract'

test('MotionExtract renders heading', () => {
  const html = renderToString(<MotionExtract />)
  assert.ok(html.includes('Motion Extract'))
})
