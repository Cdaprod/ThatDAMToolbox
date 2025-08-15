import test from 'node:test'
import assert from 'node:assert'
import React from 'react'
import { renderToString } from 'react-dom/server'
import FolderTree from '../DAMExplorer/FolderTree'
import type { FolderNode } from '../../lib/apiAssets'

test('FolderTree renders folder names', () => {
  const folders: FolderNode[] = [
    { path: '/Projects', name: 'Projects', children: [], assetCount: 0 }
  ]
  const html = renderToString(
    <FolderTree folders={folders} currentPath="/" onPathChange={() => {}} />
  )
  assert(html.includes('Projects'))
})
