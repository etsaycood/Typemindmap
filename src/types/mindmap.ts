export type LayoutMode = 'right' | 'balanced' | 'left' | 'top-down';

export type ThemeMode = 'dark' | 'light';

export type NodeColorKey =
  | 'auto'
  | 'indigo'
  | 'emerald'
  | 'amber'
  | 'purple'
  | 'rose'
  | 'cyan'
  | 'slate';

export interface OutlineNode {
  id: string;
  lineIndex: number; // 0-based line index in raw outline text
  endLineIndex: number; // inclusive last line index of this node's subtree
  indentSpaces: number;
  rawLine: string;
  text: string;
  checked?: boolean;
  tags: string[];
  url?: string;
  note?: string;
  color?: NodeColorKey;
  depth: number;
  branchIndex: number;
  direction: 'right' | 'left' | 'down';
  children: OutlineNode[];
  totalDescendants: number;
}

export interface DocumentTab {
  id: string;
  title: string;
  content: string;
  layoutMode: LayoutMode;
  updatedAt: number;
}

export interface HistoryEntry {
  content: string;
  cursorLine?: number;
}
