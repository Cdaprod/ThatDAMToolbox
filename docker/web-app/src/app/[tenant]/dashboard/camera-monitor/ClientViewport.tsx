'use client'

import DeferredMount from '@/components/ui/DeferredMount'
import { Shimmer } from '@/components/ui/Skeletons'

export default function ClientViewport() {
  // Keep canvas heavy work off the critical paint; show “warming up” shimmer
  return (
    <DeferredMount delay={160}>
      {/* replace this with your actual video/canvas node */}
      <div style={{ position:'relative' }}>
        <Shimmer style={{ width: '100%', aspectRatio: '16/9' }} />
        {/* when your stream is ready, swap to the real element */}
      </div>
    </DeferredMount>
  )
}

