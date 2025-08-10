Killer--your stack already has everything we need: Providers, Asset tree, selection bus, dashboard routes. Let’s drop a 2.5D "Layered Explorer" into your existing app with minimal churn. It reads the same AssetProvider data, renders folders as stacked planes into depth, draws 2.5D edges, and shows files as live "cards" (thumbnails/video poster). Click a folder to smoothly dolly to that layer.

Below are additive files (plus one tiny dashboard entry). All code uses your patterns (Next app-router, bus, providers).

⸻

/docker/web-app/src/components/LayeredFS/types.ts

export type NodeKind = "folder" | "file";

export interface BaseNode {
  id: string;
  name: string;
  path: string;     // e.g. "/photos/trips"
  depth: number;    // root = 0
  kind: NodeKind;
  parentId?: string | null;
}

export interface FileNode extends BaseNode {
  kind: "file";
  mime?: string;
  bytes?: number;
  previewUrl?: string;  // asset.thumbnail or poster
}

export interface FolderNode extends BaseNode {
  kind: "folder";
  childIds: string[];
  expanded?: boolean;
}

export type TreeNode = FileNode | FolderNode;

export interface TreeSnapshot {
  nodes: Record<string, TreeNode>;
  rootId: string;
}

/docker/web-app/src/components/LayeredFS/layout.ts

import { TreeSnapshot, FolderNode, TreeNode } from "./types";

export interface Positioned {
  id: string;
  x: number;
  y: number;
  z: number; // = -depth * LAYER_GAP
  w: number;
  h: number;
}

export interface LayoutResult {
  items: Record<string, Positioned>;
  edges: Array<{ from: string; to: string }>;
}

const LAYER_GAP = 3.0;
const CELL_W = 1.6, CELL_H = 1.0;
const PAD_X = 0.4, PAD_Y = 0.4;
const COLS = 6;

export function layeredLayout(tree: TreeSnapshot): LayoutResult {
  const items: Record<string, Positioned> = {};
  const edges: Array<{ from: string; to: string }> = [];

  const childrenByParent: Record<string, TreeNode[]> = {};
  Object.values(tree.nodes).forEach(n => {
    if (!n.parentId) return;
    (childrenByParent[n.parentId] ||= []).push(n);
  });

  for (const node of Object.values(tree.nodes)) {
    if (node.kind !== "folder") continue;
    const folder = node as FolderNode;
    const z = -node.depth * LAYER_GAP;

    // Folder title bar (centered)
    items[node.id] = { id: node.id, x: 0, y: 0, z, w: 2.2, h: 0.5 };

    // Children grid
    const kids = childrenByParent[node.id] || [];
    kids.sort((a,b) =>
      (a.kind === "folder" ? -1 : 1) - (b.kind === "folder" ? -1 : 1) ||
      a.name.localeCompare(b.name)
    );

    kids.forEach((child, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = (col - (COLS - 1) / 2) * (CELL_W + PAD_X);
      const y = - (row + 1) * (CELL_H + PAD_Y) - 0.8;
      items[child.id] = { id: child.id, x, y, z, w: CELL_W, h: CELL_H };
      edges.push({ from: node.id, to: child.id });
    });
  }

  return { items, edges };
}

/docker/web-app/src/components/LayeredFS/LayeredExplorer.tsx

'use client';
import React, { useMemo, useRef, useCallback } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { useAssets } from "@/providers/AssetProvider";
import { bus } from "@/lib/eventBus";
import { layeredLayout } from "./layout";
import type { TreeSnapshot, TreeNode, FolderNode } from "./types";

/* ---------- snapshot from your providers -------------------------------- */
function buildSnapshot(
  folders: Array<{ name:string; path:string; children: any[] }>,
  assets: Array<{ id:string; name:string; path:string; thumbnail?:string; mime?:string; size?:number; kind?:string }>
): TreeSnapshot {
  const nodes: Record<string, TreeNode> = {};
  const pathId = (p:string) => (p === "/" || p === "" ? "root" : p);

  // DFS folders → nodes
  const visit = (f: any, parentId: string | null, depth: number) => {
    const id = pathId(f.path);
    const node: FolderNode = {
      id, name: f.name || (f.path.split("/").filter(Boolean).pop() ?? "/"),
      path: f.path || "/", depth, kind: "folder", parentId: parentId ?? null, childIds: []
    };
    nodes[id] = node;

    // Attach child folders
    (f.children || []).forEach((c:any) => {
      const cid = pathId(c.path);
      node.childIds.push(cid);
      visit(c, id, depth + 1);
    });

    // Attach assets directly under this folder (path equality)
    assets.filter(a => a.path === f.path).forEach(a => {
      const fid = a.id;
      nodes[fid] = {
        id: fid, name: a.name, path: a.path, depth: depth + 1,
        kind: "file", parentId: id, previewUrl: a.thumbnail, mime: a.mime, bytes: a.size
      };
      node.childIds.push(fid);
    });
  };

  // Root folder(s)
  if (folders.length === 0) {
    nodes["root"] = { id:"root", name:"/", path:"/", depth:0, kind:"folder", childIds: [] };
  } else {
    folders.forEach(root => visit(root, null, 0));
  }

  return { nodes, rootId: folders.length ? pathId(folders[0].path) : "root" };
}

/* ---------- three.js bits ------------------------------------------------ */
function CameraRig({ focusZRef }: { focusZRef: React.MutableRefObject<number> }) {
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const state = useRef({ x: 0, y: 0, z: 12 });
  const drag = useRef<{ x?:number; y?:number }>({});

  const onWheel = useCallback((e: WheelEvent) => {
    state.current.z = Math.max(3, Math.min(80, state.current.z + (e.deltaY > 0 ? 1 : -1) * 1.0));
  }, []);
  const onDown = useCallback((e: PointerEvent) => { drag.current = { x:e.clientX, y:e.clientY }; }, []);
  const onMove = useCallback((e: PointerEvent) => {
    if (drag.current.x == null) return;
    const dx = (e.clientX - drag.current.x) * 0.01;
    const dy = (e.clientY - drag.current.y) * 0.01;
    state.current.x -= dx * (state.current.z/10);
    state.current.y += dy * (state.current.z/10);
    drag.current = { x:e.clientX, y:e.clientY };
  }, []);
  const onUp = useCallback(() => { drag.current = {}; }, []);

  useFrame(() => {
    if (!cam.current) return;
    const targetZ = Math.max(4, focusZRef.current + 7);
    state.current.z += (targetZ - state.current.z) * 0.06;
    cam.current.position.set(state.current.x, state.current.y, state.current.z);
    cam.current.lookAt(state.current.x, state.current.y, 0);
    cam.current.rotation.x = THREE.MathUtils.degToRad(-12);
  });

  React.useEffect(() => {
    const dom = (cam.current?.parent as any)?.__r3f.root?.gl.domElement as HTMLElement;
    if (!dom) return;
    dom.addEventListener("wheel", onWheel, { passive: true });
    dom.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onWheel, onDown, onMove, onUp]);

  return <perspectiveCamera ref={cam} fov={50} near={0.1} far={1000} position={[0,0,12]} />;
}

function Edge({ a, b }: { a:{x:number;y:number;z:number}; b:{x:number;y:number;z:number} }) {
  const mid = { x: (a.x+b.x)/2, y: (a.y+b.y)/2 + 0.3, z: a.z+0.001 };
  return (
    <Line
      points={[
        new THREE.Vector3(a.x, a.y, a.z+0.001),
        new THREE.Vector3(mid.x, mid.y, mid.z),
        new THREE.Vector3(b.x, b.y, b.z+0.001),
      ]}
      lineWidth={2}
      color="#6aa2ff"
    />
  );
}

function FileCard({ node, x, y, z }: { node: TreeNode; x:number;y:number;z:number }) {
  const [tex, setTex] = React.useState<THREE.Texture | null>(null);
  React.useEffect(() => {
    if (node.kind === "file" && (node as any).previewUrl) {
      new THREE.TextureLoader().load((node as any).previewUrl!, t => {
        t.needsUpdate = true; setTex(t);
      });
    }
  }, [node]);

  const click = () => {
    if (node.kind === "file") bus.emit('preview', { id: node.id });
  };

  return (
    <group position={[x,y,z]} onClick={click}>
      <mesh>
        <planeGeometry args={[1.6,1.0]} />
        <meshBasicMaterial map={tex ?? undefined} color={tex ? undefined : "#1f2937"} />
      </mesh>
      <Html distanceFactor={15} position={[0,-0.72,0.01]} transform occlude>
        <div style={{fontSize:12, padding:"2px 6px", borderRadius:6, background:"rgba(0,0,0,0.45)", color:"#fff", whiteSpace:"nowrap"}}>
          {node.name}
        </div>
      </Html>
    </group>
  );
}

function FolderBar({ node, x, y, z, onFocus }: { node: TreeNode; x:number;y:number;z:number; onFocus:()=>void }) {
  return (
    <group position={[x,y,z]}>
      <mesh onClick={onFocus}>
        <shapeGeometry args={[roundedRectShape(2.2, 0.5, 0.08)]} />
        <meshBasicMaterial color="#2b2f3a" />
      </mesh>
      <Html distanceFactor={20} position={[0,0,0.01]} transform>
        <div style={{color:"#dfe6f3", fontWeight:600}}>{node.name}</div>
      </Html>
    </group>
  );
}

function roundedRectShape(w:number, h:number, r:number) {
  const s = new THREE.Shape();
  const x = -w/2, y = -h/2;
  s.moveTo(x+r, y);
  s.lineTo(x+w-r, y);
  s.quadraticCurveTo(x+w, y, x+w, y+r);
  s.lineTo(x+w, y+h-r);
  s.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  s.lineTo(x+r, y+h);
  s.quadraticCurveTo(x, y+h, x, y+h-r);
  s.lineTo(x, y+r);
  s.quadraticCurveTo(x, y, x+r, y);
  return s;
}

/* ---------- main component ---------------------------------------------- */
export default function LayeredExplorer() {
  const { view: assets, folders, foldersLoading } = useAssets();
  const snapshot = useMemo(() => buildSnapshot(folders, assets), [folders, assets]);
  const layout = useMemo(() => layeredLayout(snapshot), [snapshot]);
  const focusZRef = useRef(0);

  const focusFolder = useCallback((z:number) => { focusZRef.current = z; }, []);

  if (foldersLoading) {
    return <div className="w-full h-full flex items-center justify-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="h-full w-full">
      <Canvas dpr={[1,2]} gl={{ antialias:true }}>
        <ambientLight intensity={0.8} />
        <CameraRig focusZRef={focusZRef} />

        {/* edges first */}
        {layout.edges.map((e, i) => {
          const a = layout.items[e.from], b = layout.items[e.to];
          if (!a || !b) return null;
          return <Edge key={i} a={a} b={b} />;
        })}

        {/* nodes */}
        {Object.values(snapshot.nodes).map(n => {
          const p = layout.items[n.id];
          if (!p) return null;
          return n.kind === "folder" ? (
            <FolderBar key={n.id} node={n} x={p.x} y={p.y} z={p.z} onFocus={() => focusFolder(p.z)} />
          ) : (
            <FileCard key={n.id} node={n} x={p.x} y={p.y} z={p.z} />
          );
        })}
      </Canvas>
    </div>
  );
}

/docker/web-app/src/app/dashboard/explorer/layered/page.tsx

'use client';
import dynamic from 'next/dynamic';

const LayeredExplorer = dynamic(() => import('@/components/LayeredFS/LayeredExplorer'), {
  ssr: false,
  loading: () => <div className="w-full h-[80vh] flex items-center justify-center text-gray-500">Booting GL…</div>
});

export default function Page() {
  return (
    <div className="w-screen h-[calc(100vh-2rem)] bg-[#0f1116]">
      <LayeredExplorer />
    </div>
  );
}

/docker/web-app/src/components/dashboardTools.tsx  (add one new entry or update "explorer")

  'explorer-layered': {
    id: 'explorer-layered',
    href: '/dashboard/explorer/layered',
    title: 'Layered Explorer (2.5D)',
    icon: Eye,
    color: dashboardColorClasses['explorer'],
    context: 'archive',
    relatedTools: ['dam-explorer', 'explorer'],
    lastUsed: new Date().toISOString(),
    status: 'active',
  },


⸻

Wire-up
	•	Install deps:

pnpm add three @react-three/fiber @react-three/drei


	•	Route lives at /dashboard/explorer/layered (keeps your existing Explorer intact).
	•	The scene reads the same useAssets() data:
	•	folders → stacked planes by depth = path.split('/').filter(Boolean).length
	•	view (assets) → file cards in that folder’s layer (uses thumbnail).
	•	Bus integration:
	•	Clicking a file card emits bus.emit('preview', { id }) so your existing preview modal keeps working.
	•	Performance notes:
	•	WebGL lines & planes are cheap; if a folder has thousands, paginate in buildSnapshot (easy add: only include children up to N per layer, lazy-load on focus).

Nice next steps (quick wins)
	•	Add focus pan to the folder’s centroid (now we only dolly Z; we can animate X/Y toward the clicked folder’s x,y).
	•	Add view modes: in layeredLayout, swap grid → timeline (x = createdAt).
	•	Show counts on folder bars; add drop targets for drag-move between layers (use your existing move() action).
	•	Render video posters with a tiny play icon (click → open DAMExplorer modal at that asset).

Want me to wire the focus pan + lazy children on focus in a follow-up patch? Or adapt this to PixiJS if you’d rather keep everything 2D GPU?