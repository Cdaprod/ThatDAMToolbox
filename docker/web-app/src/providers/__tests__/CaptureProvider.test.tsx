import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import CaptureProvider from '../CaptureProvider'
import { useCapture } from '../CaptureContext'

function ShowDevice() {
  const { selectedDevice } = useCapture()
  return <span>{selectedDevice}</span>
}

test('CaptureProvider restores last selected device from localStorage', () => {
  const store: Record<string, string> = { lastSelectedDevice: '/dev/video1' }
  ;(global as any).window = {
    localStorage: {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => { store[k] = v }
    }
  }
  const html = renderToString(
    <CaptureProvider>
      <ShowDevice />
    </CaptureProvider>
  )
  assert.ok(html.includes('/dev/video1'))
})
