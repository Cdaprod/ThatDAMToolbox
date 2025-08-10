'use client';
import dynamic from 'next/dynamic';

// SSR disabled because WebGL needs the browser
const LayeredExplorer = dynamic(() => import('@/components/LayeredFS/LayeredExplorer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[80vh] flex items-center justify-center text-gray-500">Booting GL…</div>
  ),
});

export default function Page() {
  return (
    <div className="w-screen h-[calc(100vh-2rem)] bg-[#0f1116]">
      <LayeredExplorer />
    </div>
  );
}
