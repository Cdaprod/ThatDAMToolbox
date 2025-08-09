import { test } from 'node:test'
import { strict as assert } from 'assert'
import { renderToString } from 'react-dom/server'
import Home from './page'

test('renders welcome text', () => {
  const html = renderToString(<Home />)
  assert.match(html, /Welcome to the platform/)
})
