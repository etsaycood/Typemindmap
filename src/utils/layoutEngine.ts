import { LayoutMode, NodeColorKey, OutlineNode } from '../types/mindmap';

export interface PositionedMindNode {
  node: OutlineNode;
  x: number; // Left X of the card
  y: number; // Top Y of the card
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  isExpanded: boolean;
}

export interface PositionedEdge {
  id: string;
  path: string;
  colorKey: NodeColorKey;
  branchIndex: number;
  depth: number;
}

export interface MindMapLayoutResult {
  nodes: PositionedMindNode[];
  edges: PositionedEdge[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
}

export interface ColorPaletteDef {
  key: NodeColorKey;
  label: string;
  hex: string;
  darkBg: string;
  darkBorder: string;
  lightBg: string;
  lightBorder: string;
  accentBg: string;
  tagClass: string;
}

export const COLOR_PALETTES: ColorPaletteDef[] = [
  {
    key: 'indigo',
    label: '靛藍',
    hex: '#6366f1',
    darkBg: 'bg-slate-900/95',
    darkBorder: 'border-indigo-500/50 hover:border-indigo-400',
    lightBg: 'bg-white',
    lightBorder: 'border-indigo-400/70 hover:border-indigo-500',
    accentBg: 'bg-indigo-500',
    tagClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
  },
  {
    key: 'emerald',
    label: '翠綠',
    hex: '#10b981',
    darkBg: 'bg-slate-900/95',
    darkBorder: 'border-emerald-500/50 hover:border-emerald-400',
    lightBg: 'bg-white',
    lightBorder: 'border-emerald-400/70 hover:border-emerald-500',
    accentBg: 'bg-emerald-500',
    tagClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  },
  {
    key: 'amber',
    label: '琥珀',
    hex: '#f59e0b',
    darkBg: 'bg-slate-900/95',
    darkBorder: 'border-amber-500/50 hover:border-amber-400',
    lightBg: 'bg-white',
    lightBorder: 'border-amber-400/70 hover:border-amber-500',
    accentBg: 'bg-amber-500',
    tagClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  },
  {
    key: 'purple',
    label: '紫羅蘭',
    hex: '#a855f7',
    darkBg: 'bg-slate-900/95',
    darkBorder: 'border-purple-500/50 hover:border-purple-400',
    lightBg: 'bg-white',
    lightBorder: 'border-purple-400/70 hover:border-purple-500',
    accentBg: 'bg-purple-500',
    tagClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
  },
  {
    key: 'rose',
    label: '玫瑰紅',
    hex: '#f43f5e',
    darkBg: 'bg-slate-900/95',
    darkBorder: 'border-rose-500/50 hover:border-rose-400',
    lightBg: 'bg-white',
    lightBorder: 'border-rose-400/70 hover:border-rose-500',
    accentBg: 'bg-rose-500',
    tagClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
  },
  {
    key: 'cyan',
    label: '青色',
    hex: '#06b6d4',
    darkBg: 'bg-slate-900/95',
    darkBorder: 'border-cyan-500/50 hover:border-cyan-400',
    lightBg: 'bg-white',
    lightBorder: 'border-cyan-400/70 hover:border-cyan-500',
    accentBg: 'bg-cyan-500',
    tagClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
  },
  {
    key: 'slate',
    label: '石板灰',
    hex: '#64748b',
    darkBg: 'bg-slate-900/95',
    darkBorder: 'border-slate-500/50 hover:border-slate-400',
    lightBg: 'bg-white',
    lightBorder: 'border-slate-400/70 hover:border-slate-500',
    accentBg: 'bg-slate-400',
    tagClass: 'bg-slate-500/20 text-slate-300 border-slate-500/40'
  }
];

export function resolveNodePalette(node: OutlineNode): ColorPaletteDef {
  if (node.color && node.color !== 'auto') {
    const found = COLOR_PALETTES.find((p) => p.key === node.color);
    if (found) return found;
  }
  const idx = Math.abs(node.branchIndex) % 6;
  return COLOR_PALETTES[idx];
}

/**
 * 估算節點卡片寬高，考量文字字數、#標籤、備註與核取方塊
 */
export function measureNodeBox(node: OutlineNode): { width: number; height: number } {
  let visualChars = 0;
  for (const ch of node.text) {
    visualChars += ch.charCodeAt(0) > 255 ? 2 : 1;
  }

  const extraCheckUnits = node.checked !== undefined ? 3 : 0;
  const totalUnits = visualChars + extraCheckUnits;

  const width =
    node.depth === 0
      ? Math.min(280, Math.max(180, totalUnits * 9 + 48))
      : Math.min(265, Math.max(155, totalUnits * 8 + 42));

  const unitsPerLine = Math.max(16, Math.floor((width - 36) / 7.5));
  const textLines = Math.max(1, Math.ceil(totalUnits / unitsPerLine));

  let height = (node.depth === 0 ? 30 : 24) + textLines * 21;
  if (node.tags.length > 0 || node.url) {
    height += 24;
  }
  if (node.note) {
    let noteUnits = 0;
    for (const ch of node.note) {
      noteUnits += ch.charCodeAt(0) > 255 ? 2 : 1;
    }
    const noteLines = Math.min(2, Math.max(1, Math.ceil(noteUnits / (unitsPerLine + 4))));
    height += 8 + noteLines * 16;
  }

  return { width, height: Math.max(44, height) };
}

/**
 * 計算四種佈局 (right / left / balanced / top-down) 的節點位置與貝茲曲線
 */
export function computeMindMapLayout(
  root: OutlineNode,
  expandedIds: Set<string>,
  layoutMode: LayoutMode
): MindMapLayoutResult {
  const nodes: PositionedMindNode[] = [];
  const edges: PositionedEdge[] = [];

  if (layoutMode === 'top-down') {
    const H_GAP = 26;
    const V_GAP = 68;
    const dimsMap = new Map<string, { w: number; h: number; subtreeW: number }>();

    const calcSubtreeW = (n: OutlineNode): number => {
      const { width, height } = measureNodeBox(n);
      const isExp = expandedIds.has(n.id) && n.children.length > 0;
      if (!isExp) {
        const sw = width + H_GAP;
        dimsMap.set(n.id, { w: width, h: height, subtreeW: sw });
        return sw;
      }
      let sumW = 0;
      for (const c of n.children) {
        sumW += calcSubtreeW(c);
      }
      const sw = Math.max(width + H_GAP, sumW);
      dimsMap.set(n.id, { w: width, h: height, subtreeW: sw });
      return sw;
    };

    calcSubtreeW(root);

    const placeVertical = (
      n: OutlineNode,
      leftX: number,
      topY: number,
      parentNode?: PositionedMindNode
    ): PositionedMindNode => {
      const d = dimsMap.get(n.id)!;
      const isExp = expandedIds.has(n.id) && n.children.length > 0;
      let centerX = leftX + d.subtreeW / 2;

      const curPositioned: PositionedMindNode = {
        node: n,
        x: centerX - d.w / 2,
        y: topY,
        centerX,
        centerY: topY + d.h / 2,
        width: d.w,
        height: d.h,
        isExpanded: isExp
      };
      nodes.push(curPositioned);

      if (isExp && n.children.length > 0) {
        let curLeft = leftX;
        const childPositionedList: PositionedMindNode[] = [];
        const childTopY = topY + d.h + V_GAP;

        for (const c of n.children) {
          const cd = dimsMap.get(c.id)!;
          const cp = placeVertical(c, curLeft, childTopY, curPositioned);
          childPositionedList.push(cp);
          curLeft += cd.subtreeW;
        }

        // Center parent above first and last child
        centerX =
          (childPositionedList[0].centerX +
            childPositionedList[childPositionedList.length - 1].centerX) /
          2;
        curPositioned.centerX = centerX;
        curPositioned.x = centerX - d.w / 2;

        // Create vertical S-curve edges after parent centerX is finalized
        for (const cp of childPositionedList) {
          const startX = curPositioned.centerX;
          const startY = curPositioned.y + curPositioned.height;
          const endX = cp.centerX;
          const endY = cp.y;
          const midY = startY + (endY - startY) * 0.5;
          edges.push({
            id: `edge_${n.id}_${cp.node.id}`,
            path: `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`,
            colorKey: cp.node.color || 'auto',
            branchIndex: cp.node.branchIndex,
            depth: cp.node.depth
          });
        }
      }

      void parentNode;
      return curPositioned;
    };

    placeVertical(root, 0, 0);
  } else {
    // Horizontal layouts: 'right', 'left', or 'balanced'
    const H_GAP = 68;
    const V_GAP = 18;
    const dimsMap = new Map<string, { w: number; h: number; subtreeH: number }>();

    const calcSubtreeH = (n: OutlineNode): number => {
      const { width, height } = measureNodeBox(n);
      const isExp = expandedIds.has(n.id) && n.children.length > 0;
      if (!isExp) {
        const sh = height + V_GAP;
        dimsMap.set(n.id, { w: width, h: height, subtreeH: sh });
        return sh;
      }
      let sumH = 0;
      for (const c of n.children) {
        sumH += calcSubtreeH(c);
      }
      const sh = Math.max(height + V_GAP, sumH);
      dimsMap.set(n.id, { w: width, h: height, subtreeH: sh });
      return sh;
    };

    // Place a single directional horizontal branch ('right' or 'left')
    const placeHorizontalSubtree = (
      n: OutlineNode,
      anchorEdgeX: number, // leftX if dir === 'right', rightX if dir === 'left'
      topY: number,
      dir: 'right' | 'left'
    ): PositionedMindNode => {
      const d = dimsMap.get(n.id)!;
      const isExp = expandedIds.has(n.id) && n.children.length > 0;
      const cardX = dir === 'right' ? anchorEdgeX : anchorEdgeX - d.w;
      let centerY = topY + d.subtreeH / 2;

      const curPositioned: PositionedMindNode = {
        node: n,
        x: cardX,
        y: centerY - d.h / 2,
        centerX: cardX + d.w / 2,
        centerY,
        width: d.w,
        height: d.h,
        isExpanded: isExp
      };
      nodes.push(curPositioned);

      if (isExp && n.children.length > 0) {
        let curTop = topY;
        const childAnchorX =
          dir === 'right' ? cardX + d.w + H_GAP : cardX - H_GAP;
        const childList: PositionedMindNode[] = [];

        for (const c of n.children) {
          const cd = dimsMap.get(c.id)!;
          const cp = placeHorizontalSubtree(c, childAnchorX, curTop, dir);
          childList.push(cp);
          curTop += cd.subtreeH;
        }

        centerY =
          (childList[0].centerY + childList[childList.length - 1].centerY) / 2;
        curPositioned.centerY = centerY;
        curPositioned.y = centerY - d.h / 2;

        for (const cp of childList) {
          const startX =
            dir === 'right'
              ? curPositioned.x + curPositioned.width
              : curPositioned.x;
          const startY = curPositioned.centerY;
          const endX = dir === 'right' ? cp.x : cp.x + cp.width;
          const endY = cp.centerY;
          const midX = startX + (endX - startX) * 0.5;
          edges.push({
            id: `edge_${n.id}_${cp.node.id}`,
            path: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`,
            colorKey: cp.node.color || 'auto',
            branchIndex: cp.node.branchIndex,
            depth: cp.node.depth
          });
        }
      }

      return curPositioned;
    };

    if (layoutMode === 'right' || layoutMode === 'left') {
      calcSubtreeH(root);
      placeHorizontalSubtree(root, 0, 0, layoutMode);
    } else {
      // 'balanced': Root at center (0, 0), split root.children into right & left groups
      const rootBox = measureNodeBox(root);
      const isRootExp = expandedIds.has(root.id) && root.children.length > 0;
      for (const c of root.children) {
        calcSubtreeH(c);
      }

      const rootPositioned: PositionedMindNode = {
        node: root,
        x: -rootBox.width / 2,
        y: -rootBox.height / 2,
        centerX: 0,
        centerY: 0,
        width: rootBox.width,
        height: rootBox.height,
        isExpanded: isRootExp
      };
      nodes.push(rootPositioned);

      if (isRootExp && root.children.length > 0) {
        const rightChildren = root.children.filter((c) => c.direction === 'right');
        const leftChildren = root.children.filter((c) => c.direction === 'left');

        const rightTotalH = rightChildren.reduce(
          (sum, c) => sum + dimsMap.get(c.id)!.subtreeH,
          0
        );
        const leftTotalH = leftChildren.reduce(
          (sum, c) => sum + dimsMap.get(c.id)!.subtreeH,
          0
        );

        let curRightTop = -rightTotalH / 2;
        const rightAnchorX = rootPositioned.x + rootPositioned.width + H_GAP;
        for (const rc of rightChildren) {
          const cp = placeHorizontalSubtree(rc, rightAnchorX, curRightTop, 'right');
          curRightTop += dimsMap.get(rc.id)!.subtreeH;

          const startX = rootPositioned.x + rootPositioned.width;
          const startY = rootPositioned.centerY;
          const endX = cp.x;
          const endY = cp.centerY;
          const midX = startX + (endX - startX) * 0.5;
          edges.push({
            id: `edge_${root.id}_${cp.node.id}`,
            path: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`,
            colorKey: cp.node.color || 'auto',
            branchIndex: cp.node.branchIndex,
            depth: cp.node.depth
          });
        }

        let curLeftTop = -leftTotalH / 2;
        const leftAnchorX = rootPositioned.x - H_GAP;
        for (const lc of leftChildren) {
          const cp = placeHorizontalSubtree(lc, leftAnchorX, curLeftTop, 'left');
          curLeftTop += dimsMap.get(lc.id)!.subtreeH;

          const startX = rootPositioned.x;
          const startY = rootPositioned.centerY;
          const endX = cp.x + cp.width;
          const endY = cp.centerY;
          const midX = startX + (endX - startX) * 0.5;
          edges.push({
            id: `edge_${root.id}_${cp.node.id}`,
            path: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`,
            colorKey: cp.node.color || 'auto',
            branchIndex: cp.node.branchIndex,
            depth: cp.node.depth
          });
        }
      }
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of nodes) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x + p.width);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y + p.height);
  }

  if (!isFinite(minX)) {
    minX = 0;
    maxX = 240;
    minY = 0;
    maxY = 80;
  }

  return {
    nodes,
    edges,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(120, maxX - minX),
      height: Math.max(80, maxY - minY)
    }
  };
}
