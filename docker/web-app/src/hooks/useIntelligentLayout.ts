import { useState, useMemo } from 'react'
import type { DashboardTool } from '../lib/toolRegistry'

/** Compute groups of tools based on status and recency */
export function computeLayoutGroups(tools: DashboardTool[]) {
  const sorted = [...tools].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1
    if (b.status === 'active' && a.status !== 'active') return 1
    return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
  })
  const primary = sorted.slice(0, 2)
  const primaryIds = new Set(primary.map(t => t.id))
  const relatedIds = new Set<string>()
  primary.forEach(t => t.relatedTools.forEach(r => relatedIds.add(r)))
  const secondary = sorted.filter(t => !primaryIds.has(t.id) && relatedIds.has(t.id))
  const tertiary = sorted.filter(t => !primaryIds.has(t.id) && !relatedIds.has(t.id))
  return { primary, secondary, tertiary }
}

/** Hook wrapper exposing focus state */
export function useIntelligentLayout(tools: DashboardTool[]) {
  const [focusedTool, setFocusedTool] = useState<string | null>(null)
  const [userIntent, setUserIntent] = useState<'browse' | 'work' | 'analyze'>('browse')
  const layoutGroups = useMemo(() => computeLayoutGroups(tools), [tools])
  return { layoutGroups, focusedTool, setFocusedTool, userIntent, setUserIntent }
}
