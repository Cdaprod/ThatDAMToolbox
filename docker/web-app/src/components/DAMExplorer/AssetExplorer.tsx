// /docker/web-app/src/components/DAMExplorer/AssetExplorer.tsx
import React, { useState, useEffect } from 'react'
import {
  Grid,
  List,
  Upload,
  Trash2,
  Tag,
  Folder,
  Move,
  RefreshCw,
  Undo2,
  FileText,
} from 'lucide-react'
import SearchBarExtension, {
  SearchResult,
  SearchFilters,
} from '@/components/SearchBarExtension'
import { useAssets } from '@/providers/AssetProvider'
import { updateAsset, Asset as ApiAsset } from '@/lib/apiAssets'
import TagPopover from '@/components/TagPopover'
import { useSelection } from '@/state/selection'
import { bus } from '@/lib/eventBus'
import AssetThumbnail from './AssetThumbnail'
import FolderTree from './FolderTree'
import StatusBar from './StatusBar'

export interface Asset extends ApiAsset {
  type?: 'image' | 'video' | 'document'
  dimensions?: string
  duration?: string
  pages?: number
  metadata?: Record<string, any>
  thumbnail?: string
  status?: 'processed' | 'processing' | 'error' | 'deleted'
}

export interface StatusMessage {
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

interface UndoOperation {
  type: 'move' | 'delete'
  assets: string[]
  fromPath: string
  toPath?: string
}

// Main Component: AssetExplorer
const AssetExplorer: React.FC = () => {
  const { view: rawView, folders, foldersLoading, move, remove, refresh, setFilters, filters } = useAssets()
  const assets = rawView as Asset[]
  const { ids: selectedAssets, clear: clearSelection } = useSelection()
  const [currentPath, setCurrentPath] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([])
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)
  const [tagging, setTagging] = useState(false)

  useEffect(() => {
    setFilters({ tags: filterTags })
  }, [filterTags, setFilters])

  const showStatus = (
    message: string,
    type: StatusMessage['type'] = 'info',
  ) => {
    setStatusMessage({ message, type })
    setTimeout(() => setStatusMessage(null), 3000)
  }

  const handlePathChange = (newPath: string) => {
    setCurrentPath(newPath)
    clearSelection()
  }

  const handleAssetMove = async (assetIds: string[], targetPath: string) => {
    setIsProcessing(true)
    const undoData: UndoOperation = {
      type: 'move',
      assets: assetIds,
      fromPath: currentPath,
      toPath: targetPath,
    }
    setUndoStack((prev) => [...prev, undoData])
    try {
      await move(assetIds, targetPath)
      showStatus(
        `Moved ${assetIds.length} asset(s) to ${targetPath}`,
        'success',
      )
      refresh()
    } catch {
      showStatus('Failed to move assets', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUndo = async () => {
    if (undoStack.length === 0) return
    const lastOperation = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))
    if (lastOperation.type === 'move') {
      setIsProcessing(true)
      try {
        await move(lastOperation.assets, lastOperation.fromPath)
        showStatus('Move operation undone', 'info')
        refresh()
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const handleDeleteAssets = async (assetIds: string[]) => {
    if (
      !confirm(`Are you sure you want to delete ${assetIds.length} asset(s)?`)
    )
      return
    setIsProcessing(true)
    try {
        await remove(assetIds)
        showStatus(`Deleted ${assetIds.length} asset(s)`, 'warning')
        clearSelection()
        refresh()
    } catch {
      showStatus('Failed to delete assets', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRename = async (asset: Asset) => {
    const newName = prompt('Rename asset', asset.name)
    if (!newName || newName === asset.name) return
    try {
      await updateAsset(asset.id, { name: newName })
      showStatus('Asset renamed', 'success')
      refresh()
    } catch {
      showStatus('Rename failed', 'error')
    }
  }

  const handlePreview = (asset: Asset) => {
    setPreviewAsset(asset)
    showStatus(`Previewing ${asset.name}`, 'info')
  }

  const handleSearch = async (
    query: string,
    filters?: SearchFilters,
  ): Promise<SearchResult[]> => {
    setFilters({ text: query })
    const lower = query.toLowerCase()
    const filtered = assets.filter((asset) => {
      const matchesQuery =
        asset.name.toLowerCase().includes(lower) ||
        asset.tags.some((tag) => tag.toLowerCase().includes(lower))
      const matchesFileType = !filters?.fileType || asset.kind === filters.fileType
      const matchesTags =
        !filters?.tags?.length || filters.tags.some((tag) => asset.tags.includes(tag))
      const matchesDate =
        (!filters?.dateFrom && !filters?.dateTo) ||
        ((!filters?.dateFrom ||
          new Date(asset.createdAt) >= new Date(filters.dateFrom)) &&
          (!filters?.dateTo || new Date(asset.createdAt) <= new Date(filters.dateTo)))
      return matchesQuery && matchesFileType && matchesTags && matchesDate
    })

    return filtered.map((asset) => ({
      id: asset.id,
      title: asset.name,
      subtitle: `${(asset.size / 1_000_000).toFixed(1)} MB • ${asset.tags.join(', ')}`,
      type: asset.kind,
      thumbnail: asset.thumbnail,
      path: asset.path,
      score: 1.0,
      metadata: {
        size: asset.size,
        created: asset.createdAt,
        modified: asset.updatedAt,
        tags: asset.tags,
      },
    }))
  }

  const handleVectorSearch = async (
    query: string,
  ): Promise<SearchResult[]> => {
    try {
      const response = await fetch('/api/vector-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await response.json()
      return data.results || []
    } catch (error) {
      console.error('Vector search failed:', error)
      return []
    }
  }

  const handleResultSelect = (result: SearchResult) => {
    const asset = assets.find((a) => a.id === result.id)
    if (asset) {
      handlePreview(asset)
    }
  }

  useEffect(() => {
    const onPreview = ({ id }: { id: string }) => {
      const asset = assets.find((a) => a.id === id)
      if (asset) handlePreview(asset)
    }
    const onTag = () => setTagging(true)
    bus.on('preview', onPreview)
    bus.on('tag-open', onTag)
    return () => {
      bus.off('preview', onPreview)
      bus.off('tag-open', onTag)
    }
  }, [assets])

  // Filter assets
  const filteredAssets = assets.filter((asset) => {
    const matchesPath = currentPath === '' || asset.path === currentPath
    const matchesFilter =
      filterTags.length === 0 ||
      filterTags.some((tag) => asset.tags.includes(tag))
    const notDeleted = asset.status !== 'deleted'

    return matchesPath && matchesFilter && notDeleted
  })

  // Get unique tags
  const availableTags = [...new Set(assets.flatMap((asset) => asset.tags))]
  const availableFileTypes = [...new Set(assets.map((asset) => asset.kind))]

  return (
    <div className="h-screen flex flex-col bg-theme-background">
      {/* Header */}
      <header className="bg-surface border-b border-color-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">Asset Explorer</h1>
            <div className="flex items-center space-x-2 text-sm text-color-muted">
              <span>{filteredAssets.length} assets</span>
              <span>•</span>
              <span className="max-w-xs truncate">{currentPath}</span>
            </div>
          </div>

          <div className="flex items-center space-x-4 min-w-0">
            <SearchBarExtension
              placeholder="Search assets, tags, metadata..."
              onSearch={handleSearch}
              onVectorSearch={handleVectorSearch}
              onResultSelect={handleResultSelect}
              availableTags={availableTags}
              availableFileTypes={availableFileTypes}
              className="w-full max-w-search-bar"
              showFilters
              showVectorSearch
            />

            {/* View Mode Toggle */}
            <div className="flex bg-surface rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-surface shadow' : ''}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-surface shadow' : ''}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="p-2 text-color-muted hover:text-theme-primary disabled:opacity-50"
                title="Undo last action"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                className="p-2 bg-theme-primary text-white rounded-lg hover:bg-color-primary-bg"
                onClick={() =>
                  showStatus(
                    'Upload functionality would be implemented here',
                    'info',
                  )
                }
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-surface border-r border-color-border overflow-y-auto">
          <div className="p-4">
            <h3 className="font-semibold mb-3">Folders</h3>
            {foldersLoading ? (
              <p className="text-sm text-color-muted">Loading…</p>
            ) : folders.length === 0 ? (
              <p className="text-sm text-color-muted">(empty)</p>
            ) : (
              <FolderTree
                folders={folders}
                currentPath={currentPath}
                onPathChange={handlePathChange}
              />
            )}
          </div>

          <div className="p-4 border-t border-color-border">
            <h3 className="font-semibold mb-3">Filter by Tags</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availableTags.map((tag) => (
                <label key={tag} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filterTags.includes(tag)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilterTags((prev) => [...prev, tag])
                      } else {
                        setFilterTags((prev) => prev.filter((t) => t !== tag))
                      }
                    }}
                    className="rounded border-color-border text-theme-primary ring-theme-primary focus:ring-1"
                  />
                  <span className="text-sm">{tag}</span>
                </label>
              ))}
            </div>
            {filterTags.length > 0 && (
              <button
                onClick={() => setFilterTags([])}
                className="mt-2 text-xs text-theme-primary hover:text-theme-primary"
              >
                Clear filters
              </button>
            )}
          </div>
        </aside>

        {/* Asset Grid */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Toolbar */}
            {selectedAssets.size > 0 && (
              <div className="flex items-center justify-between mb-6 bg-color-primary-bg p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-theme-primary">
                    {selectedAssets.size} asset
                    {selectedAssets.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        handleDeleteAssets(Array.from(selectedAssets))
                      }
                      className="flex items-center space-x-1 px-3 py-1 status-error rounded hover:opacity-90"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">Delete</span>
                    </button>
                    <button
                      className="flex items-center space-x-1 px-3 py-1 bg-surface text-color-muted rounded hover:bg-color-primary-bg"
                      onClick={() =>
                        showStatus(
                          'Move functionality would be implemented here',
                          'info',
                        )
                      }
                    >
                      <Move className="w-4 h-4" />
                      <span className="text-sm">Move</span>
                    </button>
                    <button
                      className="flex items-center space-x-1 px-3 py-1 bg-surface text-color-muted rounded hover:bg-color-primary-bg"
                      onClick={() => setTagging(true)}
                    >
                      <Tag className="w-4 h-4" />
                      <span className="text-sm">Tag</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={clearSelection}
                  className="text-sm text-color-muted hover:text-theme-primary"
                >
                  Clear selection
                </button>
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex items-center space-x-2 text-sm text-color-muted mb-4">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </div>
            )}

            {/* Asset Grid/List */}
            <div
              className={`${
                viewMode === 'grid'
                  ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
                  : 'space-y-2'
              }`}
            >
              {filteredAssets.map((asset) => (
              <AssetThumbnail key={asset.id} asset={asset} />
            ))}
            </div>

            {/* Empty state */}
            {filteredAssets.length === 0 && (
              <div className="text-center py-12">
                <div className="text-color-muted mb-4">
                  <Folder className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  No assets found
                </h3>
                <p className="text-color-muted mb-4">
                  {filters.text || filterTags.length > 0
                    ? 'Try adjusting your search or filters'
                    : 'This folder is empty'}
                </p>
                {(filters.text || filterTags.length > 0) && (
                  <div className="space-x-2">
                    {filters.text && (
                      <button
                        onClick={() => setFilters({ text: '' })}
                        className="px-4 py-2 bg-theme-primary text-white rounded hover:bg-color-primary-bg"
                      >
                        Clear search
                      </button>
                    )}
                    {filterTags.length > 0 && (
                      <button
                        onClick={() => setFilterTags([])}
                        className="px-4 py-2 bg-surface text-color-muted rounded hover:bg-color-primary-bg"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-60">
          <div className="bg-surface rounded-lg shadow-lg p-6 w-full max-w-xl relative">
            <button
              className="absolute top-2 right-2 text-color-muted hover:text-theme-primary"
              onClick={() => setPreviewAsset(null)}
            >
              ×
            </button>
            <h3 className="text-lg font-semibold mb-2">{previewAsset.name}</h3>
            {previewAsset.type === 'image' && previewAsset.thumbnail && (
              <img
                src={previewAsset.thumbnail}
                alt={previewAsset.name}
                className="w-full h-auto mb-4 rounded"
              />
            )}
            {previewAsset.type === 'video' && (
              <video
                controls
                src={previewAsset.thumbnail}
                className="w-full h-auto mb-4 rounded"
              />
            )}
            {previewAsset.type === 'document' && (
              <div className="mb-4 p-4 bg-surface rounded">
                <FileText className="w-8 h-8 mb-2" />
                <div className="text-xs text-color-muted">
                  Document preview unavailable.
                </div>
              </div>
            )}
            <div className="text-sm text-color-muted">
              <div>
                <b>Type:</b> {previewAsset.type}
              </div>
              <div>
                <b>Size:</b> {previewAsset.size} MB
              </div>
              <div>
                <b>Created:</b>{' '}
                {new Date(previewAsset.createdAt ?? '').toLocaleString()}
              </div>
              <div>
                <b>Modified:</b>{' '}
                {new Date(previewAsset.updatedAt ?? '').toLocaleString()}
              </div>
              <div>
                <b>Path:</b> {previewAsset.path}
              </div>
              <div>
                <b>Tags:</b> {previewAsset.tags.join(', ')}
              </div>
              <div>
                <b>Status:</b> {previewAsset.status}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <StatusBar
        message={statusMessage?.message}
        type={statusMessage?.type}
        onDismiss={() => setStatusMessage(null)}
      />
      {tagging && (
        <TagPopover
          selectedIds={[...selectedAssets]}
          onClose={() => setTagging(false)}
        />
      )}
    </div>
  )
}

export default AssetExplorer
