import { useRef } from 'react'

/**
 * Allows selecting a video from local device, DAM files, or camera.
 *
 * Example:
 * ```tsx
 * <UploadPicker
 *   onSelectFile={setFile}
 *   onSelectDam={() => router.push('/dashboard/dam-explorer')}
 *   onSelectCamera={() => router.push('/dashboard/camera-monitor')}
 * />
 * ```
 */
export default function UploadPicker({
  onSelectFile,
  onSelectDam,
  onSelectCamera,
}: {
  onSelectFile: (file: File) => void
  onSelectDam?: () => void
  onSelectCamera?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="px-4 py-2 bg-blue-600 text-white rounded"
        onClick={() => inputRef.current?.click()}
      >
        Upload
      </button>
      <button
        type="button"
        className="px-4 py-2 bg-gray-200 rounded"
        onClick={onSelectDam}
      >
        Files
      </button>
      <button
        type="button"
        className="px-4 py-2 bg-gray-200 rounded"
        onClick={onSelectCamera}
      >
        Camera
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onSelectFile(file)
        }}
      />
    </div>
  )
}
