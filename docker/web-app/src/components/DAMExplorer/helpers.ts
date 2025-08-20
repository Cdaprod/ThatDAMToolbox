import { SearchResult, SearchFilters } from '@/components/SearchBarExtension'
import { Asset as ApiAsset } from '@/lib/apiAssets'

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

export const toSearchResult = (asset: Asset): SearchResult => ({
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
})

export const filterAssets = (
  assets: Asset[],
  query: string,
  filters?: SearchFilters,
): SearchResult[] => {
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

  return filtered.map(toSearchResult)
}

export const performVectorSearch = async (
  query: string,
  vectorFn: (q: string) => Promise<Asset[]>,
  showStatus: (msg: string, type?: StatusMessage['type']) => void,
): Promise<SearchResult[]> => {
  try {
    const hits = await vectorFn(query)
    return hits.map(toSearchResult)
  } catch (error) {
    console.error('Vector search failed:', error)
    showStatus('Vector search failed', 'error')
    return []
  }
}

export const findAssetById = (assets: Asset[], id: string) =>
  assets.find((a) => a.id === id)

export const confirmDeletion = async (
  assetIds: string[],
  removeFn: (ids: string[]) => Promise<void>,
  confirmFn: (msg: string) => boolean,
): Promise<boolean> => {
  if (!confirmFn(`Are you sure you want to delete ${assetIds.length} asset(s)?`))
    return false
  await removeFn(assetIds)
  return true
}
