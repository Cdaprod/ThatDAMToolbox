/**
Utilities to position folder and file nodes into 2.5D layers.
Each folder depth maps to a Z offset while children are placed in a grid.
*/

import { TreeSnapshot, FolderNode, TreeNode } from './types';

export interface Positioned {
  id: string;
  x: number;
  y: number;
  z: number; // negative numbers move away from camera
  w: number;
  h: number;
}

export interface LayoutResult {
  items: Record<string, Positioned>;
  edges: Array<{ from: string; to: string }>;
}

const LAYER_GAP = 3;
const CELL_W = 1.6;
const CELL_H = 1.0;
const PAD_X = 0.4;
const PAD_Y = 0.4;
const COLS = 6;

/**
 * Compute positions for every node and connecting edges.
 *
 * Example:
 * ```ts
 * const layout = layeredLayout(snapshot);
 * console.log(layout.items[nodeId]); // {x,y,z,w,h}
 * ```
 */
export function layeredLayout(tree: TreeSnapshot): LayoutResult {
  const items: Record<string, Positioned> = {};
  const edges: Array<{ from: string; to: string }> = [];

  const childrenByParent: Record<string, TreeNode[]> = {};
  Object.values(tree.nodes).forEach(n => {
    if (n.parentId) (childrenByParent[n.parentId] ||= []).push(n);
  });

  for (const node of Object.values(tree.nodes)) {
    if (node.kind !== 'folder') continue;
    const folder = node as FolderNode;
    const z = -node.depth * LAYER_GAP;
    items[node.id] = { id: node.id, x: 0, y: 0, z, w: 2.2, h: 0.5 };

    const kids = (childrenByParent[node.id] || []).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    kids.forEach((child, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = (col - (COLS - 1) / 2) * (CELL_W + PAD_X);
      const y = -(row + 1) * (CELL_H + PAD_Y) - 0.8;
      const childPos: Positioned = {
        id: child.id,
        x,
        y,
        z,
        w: CELL_W,
        h: CELL_H,
      };
      items[child.id] = childPos;
      edges.push({ from: node.id, to: child.id });
    });
  }

  return { items, edges };
}
