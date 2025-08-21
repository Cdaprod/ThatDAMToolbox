import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import UploadPicker from '../primitives/UploadPicker'

test('UploadPicker renders options', () => {
  const html = renderToString(
    <UploadPicker onSelectFile={() => {}} onSelectDam={() => {}} onSelectCamera={() => {}} />
  )
  assert.ok(html.includes('Upload'))
  assert.ok(html.includes('Files'))
  assert.ok(html.includes('Camera'))
})
