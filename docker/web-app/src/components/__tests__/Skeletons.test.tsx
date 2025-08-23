import assert from 'node:assert'
import test from 'node:test'
import { renderToString } from 'react-dom/server'
import { CameraViewportSkeleton, ControlRowSkeleton, ListSkeleton } from '../ui/Skeletons'

test('CameraViewportSkeleton renders with aspect ratio', () => {
  const html = renderToString(<CameraViewportSkeleton />)
  assert.ok(html.includes('aspect-ratio'))
})

test('ControlRowSkeleton renders four items', () => {
  const html = renderToString(<ControlRowSkeleton />)
  const count = (html.match(/background/g) || []).length
  assert.equal(count, 4)
})

test('ListSkeleton renders given rows', () => {
  const html = renderToString(<ListSkeleton rows={3} />)
  const count = (html.match(/background/g) || []).length
  assert.equal(count, 3)
})

