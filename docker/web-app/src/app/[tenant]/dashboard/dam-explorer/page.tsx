// app/dashboard/dam-explorer/page.tsx
'use client';
import safeDynamic from '@/lib/safeDynamic';

const DAMExplorer = safeDynamic(
  () => import('@/components/DAMExplorer'),
  { ssr: false }
);

export default function DAMExplorerPage() {
  return <DAMExplorer />;
}