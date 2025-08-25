'use client';

/**
 * Client-only wrapper for the NeonTitle component.
 * Usage: <NeonTitle title="Hello" subtitle="World" />
 */
import dynamic from 'next/dynamic';

const NeonTitle = dynamic(() => import('./NeonTitle'), { ssr: false });

export default NeonTitle;
