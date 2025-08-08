import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import AnalyticsCard from '../tools/AnalyticsCard'

test('AnalyticsCard renders heading', () => {
  const html = renderToString(<AnalyticsCard />)
  assert.ok(html.includes('Library Stats'))
})
