'use client';

/**
 * Client-only wrapper for the VoidScene component.
 * Usage: <VoidScene />
 */
import dynamic from 'next/dynamic';

const VoidScene = dynamic(() => import('./VoidScene'), { ssr: false });

export default VoidScene;
