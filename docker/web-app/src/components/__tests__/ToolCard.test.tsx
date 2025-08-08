import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import ToolCard from '../ToolCard'
import { dashboardTools } from '../dashboardTools'

test('ToolCard renders by id', () => {
  const id = Object.keys(dashboardTools)[0]
  const html = renderToString(<ToolCard toolId={id} />)
  assert.ok(html.includes(dashboardTools[id].title))
})

test('ToolCard returns empty for missing id', () => {
  const html = renderToString(<ToolCard toolId="missing" />)
  assert.equal(html, '')
})
