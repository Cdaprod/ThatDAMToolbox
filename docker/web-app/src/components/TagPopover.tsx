// /docker/web-app/src/components/TagPopover.tsx
'use client'
import { useState } from 'react'
import { useAssets } from '@/providers/AssetProvider'

interface Props {
  selectedIds: string[]
  onClose: () => void
}

export default function TagPopover({ selectedIds, onClose }: Props) {
  const [tag, setTag] = useState('')
  const [loading, setLoading] = useState(false)
  const { refresh } = useAssets()

  const save = async () => {
    if (!tag) return
    setLoading(true)
    try {
      await fetch(`/api/assets/${selectedIds.join(',')}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addTags: [tag] }),
      })
      await refresh()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded shadow max-w-sm w-full space-y-2">
        <input
          value={tag}
          onChange={e => setTag(e.target.value)}
          className="w-full border px-2 py-1 rounded"
          placeholder="Add tag"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-2 py-1 text-sm">Cancel</button>
          <button
            disabled={loading}
            onClick={save}
            className="px-2 py-1 bg-blue-600 text-white text-sm rounded"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
