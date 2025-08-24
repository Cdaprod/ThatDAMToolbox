/**
Experimental 2.5D file explorer using @react-three/fiber.
Folders are placed on depth layers and files render as thumbnail planes.
The grid adapts its column count to the viewport for a responsive,
infinite-canvas feel.

Usage:
```tsx
<LayeredExplorer /> // requires AssetProvider context
```
*/

'use client';

import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line as DreiLine } from '@react-three/drei';
import { useAssets } from '@/providers/AssetProvider';
import { bus } from '../../lib/eventBus';
import { layeredLayout } from './layout';
import type { TreeSnapshot, TreeNode, FolderNode } from './types';

// Build a TreeSnapshot from provider data
function buildSnapshot(
  folders: Array<{ name: string; path: string; children: any[] }>,
  assets: Array<{ id: string; name: string; path: string; thumbnail?: string; mime?: string; size?: number; kind?: string }>,
): TreeSnapshot {
  const nodes: Record<string, TreeNode> = {};
  const pathId = (p: string) => (p === '/' || p === '' ? 'root' : p);

  const visit = (f: any, parentId: string | null, depth: number) => {
    const id = pathId(f.path);
    const node: FolderNode = {
      id,
      name: f.name || (f.path.split('/').filter(Boolean).pop() ?? '/'),
      path: f.path || '/',
      depth,
      kind: 'folder',
      parentId: parentId ?? null,
      childIds: [],
    };
    nodes[id] = node;

    (f.children || []).forEach((c: any) => {
      node.childIds.push(pathId(c.path));
      visit(c, id, depth + 1);
    });

    assets.filter(a => a.path === f.path).forEach(a => {
      const fid = a.id;
      nodes[fid] = {
        id: fid,
        name: a.name,
        path: a.path,
        depth: depth + 1,
        kind: 'file',
        parentId: id,
        previewUrl: a.thumbnail,
        mime: a.mime,
        bytes: a.size,
      };
      node.childIds.push(fid);
    });
  };

  if (folders.length === 0) {
    nodes['root'] = { id: 'root', name: '/', path: '/', depth: 0, kind: 'folder', childIds: [] };
  } else {
    folders.forEach(root => visit(root, null, 0));
  }

  return { nodes, rootId: folders.length ? pathId(folders[0].path) : 'root' };
}

// Camera controller: dolly/drag
function CameraRig({ focusZ }: { focusZ: React.MutableRefObject<number> }) {
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const state = useRef({ x: 0, y: 0, z: 12 });
  const drag = useRef<{ x?: number; y?: number }>({});

  const onWheel = useCallback((e: WheelEvent) => {
    state.current.z = Math.max(3, Math.min(80, state.current.z + Math.sign(e.deltaY)));
  }, []);
  const onDown = useCallback((e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMove = useCallback((e: PointerEvent) => {
    if (drag.current.x == null || drag.current.y == null) return;
    const dx = (e.clientX - drag.current.x) * 0.01;
    const dy = (e.clientY - drag.current.y) * 0.01;
    state.current.x -= dx * (state.current.z / 10);
    state.current.y += dy * (state.current.z / 10);
    drag.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onUp = useCallback(() => {
    drag.current = {};
  }, []);

  useFrame(() => {
    if (!cam.current) return;
    const targetZ = Math.max(4, focusZ.current + 7);
    state.current.z += (targetZ - state.current.z) * 0.06;
    cam.current.position.set(state.current.x, state.current.y, state.current.z);
    cam.current.lookAt(state.current.x, state.current.y, 0);
    cam.current.rotation.x = THREE.MathUtils.degToRad(-12);
  });

  React.useEffect(() => {
    const dom = (cam.current?.parent as any)?.__r3f.root?.gl.domElement as HTMLElement;
    if (!dom) return;
    dom.addEventListener('wheel', onWheel, { passive: true });
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [onWheel, onDown, onMove, onUp]);

  return <perspectiveCamera ref={cam} fov={50} near={0.1} far={1000} position={[0, 0, 12]} />;
}

function Edge({ a, b }: { a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number } }) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 0.3, z: a.z + 0.001 };
  return (
    // @ts-ignore drei line types
    <DreiLine
      points={[
        new THREE.Vector3(a.x, a.y, a.z + 0.001),
        new THREE.Vector3(mid.x, mid.y, mid.z),
        new THREE.Vector3(b.x, b.y, b.z + 0.001),
      ]}
      lineWidth={2}
      color="#6aa2ff"
    />
  );
}

function FileCard({ node, pos }: { node: TreeNode; pos: { x: number; y: number; z: number } }) {
  const [tex, setTex] = React.useState<THREE.Texture | null>(null);
  React.useEffect(() => {
    if (node.kind === 'file' && (node as any).previewUrl) {
      new THREE.TextureLoader().load((node as any).previewUrl!, (t: THREE.Texture) => {
        t.needsUpdate = true;
        setTex(t);
      });
    }
  }, [node]);

  const click = () => {
    if (node.kind === 'file') bus.emit('preview', { id: node.id });
  };

  return (
    <group position={[pos.x, pos.y, pos.z]} onClick={click}>
      <mesh>
        <planeGeometry args={[1.6, 1.0]} />
        <meshBasicMaterial map={tex ?? undefined} color={tex ? undefined : '#1f2937'} />
      </mesh>
      <Html distanceFactor={15} position={[0, -0.72, 0.01]} transform occlude>
        <div style={{ fontSize: 12, padding: '2px 6px', borderRadius: 6, background: 'rgba(0,0,0,0.45)', color: '#fff', whiteSpace: 'nowrap' }}>
          {node.name}
        </div>
      </Html>
    </group>
  );
}

function FolderBar({ node, pos, onFocus }: { node: TreeNode; pos: { x: number; y: number; z: number }; onFocus: () => void }) {
  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <mesh onClick={onFocus}>
        <shapeGeometry args={[roundedRectShape(2.2, 0.5, 0.08)]} />
        <meshBasicMaterial color="#2b2f3a" />
      </mesh>
      <Html distanceFactor={20} position={[0, 0, 0.01]} transform>
        <div style={{ color: '#dfe6f3', fontWeight: 600 }}>{node.name}</div>
      </Html>
    </group>
  );
}

function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2,
    y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export default function LayeredExplorer() {
  const { view: assets, folders, foldersLoading } = useAssets();

  const getCols = (w: number) => (w < 640 ? 2 : w < 1024 ? 4 : 6);
  const [cols, setCols] = useState(() => (typeof window === 'undefined' ? 6 : getCols(window.innerWidth)));
  useEffect(() => {
    const onResize = () => setCols(getCols(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const snapshot = useMemo(() => buildSnapshot(folders, assets), [folders, assets]);
  const layout = useMemo(() => layeredLayout(snapshot, { cols }), [snapshot, cols]);
  const focusZ = useRef(0);
  const focusFolder = useCallback((z: number) => {
    focusZ.current = z;
  }, []);

  if (foldersLoading) {
    return <div className="w-full h-full flex items-center justify-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="h-full w-full">
      <Canvas dpr={[1, 2]} gl={{ antialias: true }} className="h-full w-full">
        <ambientLight intensity={0.8} />
        <CameraRig focusZ={focusZ} />

        {layout.edges.map((e, i) => {
          const a = layout.items[e.from];
          const b = layout.items[e.to];
          if (!a || !b) return null;
          return <Edge key={i} a={a} b={b} />;
        })}

        {Object.values(snapshot.nodes).map(n => {
          const p = layout.items[n.id];
          if (!p) return null;
          return n.kind === 'folder' ? (
            <FolderBar key={n.id} node={n} pos={p} onFocus={() => focusFolder(p.z)} />
          ) : (
            <FileCard key={n.id} node={n} pos={p} />
          );
        })}
      </Canvas>
    </div>
  );
}
