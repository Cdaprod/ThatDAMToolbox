import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import FFmpegConsole from '../tools/FFmpegConsole'

test('FFmpegConsole renders run button', () => {
  const html = renderToString(<FFmpegConsole />)
  assert.ok(html.includes('Run'))
})
