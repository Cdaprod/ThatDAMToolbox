// app/[tenant]/dashboard/layered-explorer/page.tsx
// Renders the experimental 2.5D Layered Explorer.
// Example: navigate to /{tenant}/dashboard/layered-explorer
'use client';

import LayeredExplorer from '@/components/LayeredFS/LayeredExplorer';

export default function LayeredExplorerPage() {
  return (
    <div className="w-full h-full">
      <LayeredExplorer />
    </div>
  );
}
