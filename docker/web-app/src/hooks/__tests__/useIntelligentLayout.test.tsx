import assert from 'node:assert'
import test from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { computeLayoutGroups, useIntelligentLayout } from '../useIntelligentLayout'
import type { DashboardTool } from '@/lib/toolRegistry'
import { dashboardTools } from '../../components/dashboardTools'

const sample: DashboardTool[] = [
  {
    id: 'a', href: '', title: 'A', icon: () => null, color: '', context: '',
    relatedTools: ['b'], lastUsed: '2024-01-20T00:00:00Z', status: 'active'
  },
  {
    id: 'b', href: '', title: 'B', icon: () => null, color: '', context: '',
    relatedTools: [], lastUsed: '2024-01-18T00:00:00Z', status: 'idle'
  },
  {
    id: 'c', href: '', title: 'C', icon: () => null, color: '', context: '',
    relatedTools: [], lastUsed: '2024-01-19T00:00:00Z', status: 'idle'
  }
]

test('groups tools intelligently', () => {
  const groups = computeLayoutGroups(sample)
  assert.equal(groups.primary.length, 2)
  assert.ok(groups.secondary.find(t => t.id === 'b'))
})

test('provides focus setter', () => {
  let hook: any
  function Test() {
    hook = useIntelligentLayout(sample)
    return null
  }
  renderToString(<Test />)
  assert.equal(hook.focusedTool, null)
  assert.equal(typeof hook.setFocusedTool, 'function')
})

test('works with dashboardTools record', () => {
  assert.doesNotThrow(() => {
    const groups = computeLayoutGroups(Object.values(dashboardTools))
    assert.ok(Array.isArray(groups.primary))
  })
})
