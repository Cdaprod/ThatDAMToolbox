/**
Interfaces describing nodes for the Layered Explorer.
Used by layeredLayout and LayeredExplorer to build a 2.5D view.
*/

export type NodeKind = 'folder' | 'file';

export interface BaseNode {
  id: string;
  name: string;
  path: string; // full path, e.g. "/Photos/Trip"
  depth: number; // root = 0
  kind: NodeKind;
  parentId?: string | null;
}

export interface FileNode extends BaseNode {
  kind: 'file';
  mime?: string;
  bytes?: number;
  previewUrl?: string; // thumbnail or poster URL
}

export interface FolderNode extends BaseNode {
  kind: 'folder';
  childIds: string[];
  expanded?: boolean;
}

export type TreeNode = FileNode | FolderNode;

export interface TreeSnapshot {
  nodes: Record<string, TreeNode>;
  rootId: string;
}
