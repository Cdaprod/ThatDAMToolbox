// /docker/web-app/src/components/DAMExplorer/AssetThumbnail.tsx
import React from 'react'
import { Image, Video, FileText } from 'lucide-react'
import SelectableItem from '../primitives/SelectableItem'
import { useAssetActions } from '../../tools/dam-explorer/actions'
import type { Asset } from './AssetExplorer'

export const getStatusColor = (status?: Asset['status']) => {
  switch (status) {
    case 'processed':
      return 'bg-green-100 text-green-800'
    case 'processing':
      return 'bg-yellow-100 text-yellow-800'
    case 'error':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

// Thumbnail representation for a single asset
const AssetThumbnail: React.FC<{ asset: Asset }> = ({ asset }) => {
  const actions = useAssetActions(asset)
  const getIcon = (type: Asset['type'] | Asset['kind']) => {
    switch (type) {
      case 'image':
        return <Image className="w-8 h-8" />
      case 'video':
        return <Video className="w-8 h-8" />
      default:
        return <FileText className="w-8 h-8" />
    }
  }

  const sizeMb = (asset.size / 1_000_000).toFixed(1)

  return (
    <SelectableItem
      id={asset.id}
      actions={actions}
      className="relative group cursor-pointer p-3 transition-all duration-200 hover:shadow-md border-color-border bg-surface rounded-lg border"
    >
      {/* Thumbnail or Icon */}
      <div className="aspect-square mb-2 bg-surface rounded-md flex items-center justify-center overflow-hidden">
        {asset.thumbnail ? (
          <img
            src={asset.thumbnail}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-color-muted">{getIcon(asset.type ?? asset.kind)}</div>
        )}
      </div>

      {/* Asset Info */}
      <div className="space-y-1">
        <h4 className="font-medium text-sm truncate" title={asset.name}>
          {asset.name}
        </h4>
        <div className="flex items-center justify-between text-xs text-color-muted">
          <span>{sizeMb} MB</span>
          <span
            className={`px-2 py-1 rounded-full text-xs ${getStatusColor(asset.status)}`}
          >
            {asset.status ?? 'processed'}
          </span>
        </div>
      </div>
    </SelectableItem>
  )
}

export default AssetThumbnail
