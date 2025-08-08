import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { BatchCard, VideoCard, UploadCard } from '../Cards'

test('BatchCard renders', () => {
  const html = renderToString(
    <BatchCard batch={{ id: '1', count: 2 }} onClick={() => {}} />
  )
  assert.ok(html.includes('📁'))
})

test('VideoCard renders', () => {
  const html = renderToString(
    <VideoCard data={{ artifact: { path: 'a', preview: '' } }} />
  )
  assert.ok(html.includes('video-card'))
})

test('UploadCard renders', () => {
  const html = renderToString(
    <UploadCard onUpload={() => {}} />
  )
  assert.ok(html.includes('Upload'))
})
