import test from 'node:test'
import assert from 'node:assert'
import React from 'react'
import { renderToString } from 'react-dom/server'
import StatusBar from '../DAMExplorer/StatusBar'

test('StatusBar renders message', () => {
  const html = renderToString(
    <StatusBar message="hello" type="info" />
  )
  assert(html.includes('hello'))
})

test('StatusBar applies status class', () => {
  const html = renderToString(
    <StatusBar message="ok" type="success" />
  )
  assert(html.includes('status-success'))
})
