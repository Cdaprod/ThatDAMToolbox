// Root-level route suspense (used during initial server load and parallel route swaps)
import { CameraViewportSkeleton, ControlRowSkeleton, ListSkeleton } from '@/components/ui/Skeletons'

export default function RootLoading() {
  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      <CameraViewportSkeleton />
      <ControlRowSkeleton />
      <ListSkeleton rows={5} />
    </div>
  )
}

