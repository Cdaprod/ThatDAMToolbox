// /docker/web-app/src/components/DAMExplorer/FolderTree.tsx
import React, { useState } from 'react'
import { ChevronRight, ChevronDown, Folder } from 'lucide-react'
import type { FolderNode } from '../../lib/apiAssets'
import { folderIndentStyle } from '../../styles/theme'

interface Props {
  folders: FolderNode[]
  currentPath: string
  onPathChange: (path: string) => void
}

// Recursive tree rendering for folders
const FolderTree: React.FC<Props> = ({ folders, currentPath, onPathChange }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (path: string) =>
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(path) ? s.delete(path) : s.add(path)
      return s
    })

  const renderFolder = (folder: FolderNode, level = 0): React.ReactNode => {
    const isOpen = expanded.has(folder.path)
    return (
      <div key={folder.path} style={folderIndentStyle(level)}>
        <div
          className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-surface ${
            currentPath === folder.path ? 'bg-color-primary-bg text-theme-primary' : ''
          }`}
          onClick={() => onPathChange(folder.path)}
        >
          <button
            onClick={e => {
              e.stopPropagation()
              toggle(folder.path)
            }}
            className="p-1 hover:bg-surface rounded"
          >
            {folder.children.length > 0 ? (
              isOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}
          </button>
          <Folder className="w-4 h-4 text-color-muted" />
          <span className="text-sm">{folder.name}</span>
        </div>
        {isOpen && folder.children.map(child => renderFolder(child, level + 1))}
      </div>
    )
  }

  return <div className="space-y-1">{folders.map(root => renderFolder(root))}</div>
}

export default FolderTree
