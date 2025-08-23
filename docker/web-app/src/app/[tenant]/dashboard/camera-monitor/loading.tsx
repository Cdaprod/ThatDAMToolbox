import { CameraViewportSkeleton, ControlRowSkeleton, ListSkeleton } from '@/components/ui/Skeletons'

export default function CameraMonitorLoading() {
  return (
    <div style={{ padding: 16, display: 'grid', gap: 16 }}>
      {/* viewport on top */}
      <CameraViewportSkeleton />
      {/* codec / input row */}
      <ControlRowSkeleton />
      {/* record/monitor/display/audio row */}
      <ControlRowSkeleton />
      {/* any side lists */}
      <ListSkeleton rows={6} />
    </div>
  )
}

