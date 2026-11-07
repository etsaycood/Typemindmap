import { LayoutMode, NodeColorKey, OutlineNode } from '../types/mindmap';

const VALID_COLORS: Set<string> = new Set([
  'auto',
  'indigo',
  'emerald',
  'amber',
  'purple',
  'rose',
  'cyan',
  'slate'
]);

export interface ParsedLineAttrs {
  text: string;
  checked?: boolean;
  tags: string[];
  color?: NodeColorKey;
  url?: string;
  note?: string;
}

/**
 * 解析單行縮排文字中的文字、核取方塊 [ ]/[x]、#標籤、@color()、@url() 與 // 備註
 */
export function parseLineAttributes(rawTrimmed: string): ParsedLineAttrs {
  let working = rawTrimmed.trim();

  // Strip optional markdown list prefix if user pasted markdown (- , * , + ) without breaking [ ]
  working = working.replace(/^[-*+]\s+(?!\[[ xX]\])/, '');
  // Strip optional mermaid root((...)) wrapper if pasted
  working = working.replace(/^root\(\((.+)\)\)$/i, '$1');

  // 1. Extract trailing note: " // ..." (avoid matching https://)
  let note: string | undefined;
  const noteMatch = working.match(/(?:^|\s)\/\/\s*(.+)$/);
  if (noteMatch && noteMatch.index !== undefined) {
    note = noteMatch[1].trim();
    working = working.slice(0, noteMatch.index).trim();
  }

  // 2. Extract leading checkbox: [x] or [ ]
  let checked: boolean | undefined;
  const checkMatch = working.match(/^\[([ xX])\]\s*(.*)$/);
  if (checkMatch) {
    checked = checkMatch[1].toLowerCase() === 'x';
    working = checkMatch[2].trim();
  }

  // 3. Extract @color(name)
  let color: NodeColorKey | undefined;
  working = working.replace(/@color\(([a-zA-Z]+)\)/gi, (_m, cName: string) => {
    const lower = cName.toLowerCase();
    if (VALID_COLORS.has(lower)) {
      color = lower as NodeColorKey;
    }
    return '';
  });

  // 4. Extract @url(...) or standalone https://...
  let url: string | undefined;
  working = working.replace(/@url\(([^)\s]+)\)/gi, (_m, u: string) => {
    url = u.trim();
    return '';
  });
  if (!url) {
    const bareUrlMatch = working.match(/(?:^|\s)(https?:\/\/[^\s]+)/i);
    if (bareUrlMatch) {
      url = bareUrlMatch[1];
      working = working.replace(bareUrlMatch[1], '').trim();
    }
  }

  // 5. Extract #tags
  const tags: string[] = [];
  working = working.replace(/(?:^|\s)#([^\s#@/]+)/g, (_m, tagText: string) => {
    if (tagText) tags.push(tagText);
    return '';
  });

  const cleanText = working.replace(/\s{2,}/g, ' ').trim() || '未命名節點';

  return {
    text: cleanText,
    checked,
    tags,
    color,
    url,
    note
  };
}

/**
 * 將節點屬性組裝回標準單行縮排字串
 */
export function composeOutlineLine(
  indentSpaces: number,
  attrs: ParsedLineAttrs,
  allowEmptyText: boolean = false
): string {
  const prefix = ' '.repeat(Math.max(0, indentSpaces));
  const checkPart =
    attrs.checked === true ? '[x] ' : attrs.checked === false ? '[ ] ' : '';
  const trimmedText = (attrs.text ?? '').trim();
  const textPart = allowEmptyText ? trimmedText : trimmedText || '新節點';
  const tagsPart =
    attrs.tags && attrs.tags.length > 0
      ? ' ' + attrs.tags.map((t) => `#${t.replace(/^#/, '')}`).join(' ')
      : '';
  const colorPart =
    attrs.color && attrs.color !== 'auto' ? ` @color(${attrs.color})` : '';
  const urlPart = attrs.url ? ` @url(${attrs.url})` : '';
  const notePart = attrs.note ? ` // ${attrs.note}` : '';

  return `${prefix}${checkPart}${textPart}${tagsPart}${colorPart}${urlPart}${notePart}`;
}

interface RawParsedItem {
  lineIndex: number;
  endLineIndex: number;
  indentSpaces: number;
  rawLine: string;
  attrs: ParsedLineAttrs;
  children: RawParsedItem[];
}

/**
 * 將縮排文字解析為完整雙向對應的 OutlineNode 樹狀結構
 */
export function parseOutlineToTree(
  content: string,
  layoutMode: LayoutMode = 'right',
  fallbackDocTitle: string = '核心主題',
  pendingEmptyLineIndex: number | null = null
): OutlineNode {
  const rawLines = content.replace(/\r\n/g, '\n').split('\n');
  const stack: RawParsedItem[] = [];
  const topItems: RawParsedItem[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();
    const isPendingEmpty = pendingEmptyLineIndex !== null && i === pendingEmptyLineIndex && !trimmed;

    if ((!trimmed && !isPendingEmpty) || /^mindmap\b/i.test(trimmed) || /^```/.test(trimmed)) {
      continue;
    }

    const expandedTabs = rawLine.replace(/\t/g, '  ');
    const indentSpaces = expandedTabs.match(/^\s*/)?.[0].length ?? 0;
    const attrs: ParsedLineAttrs = isPendingEmpty
      ? { text: '', tags: [] }
      : parseLineAttributes(trimmed);

    const item: RawParsedItem = {
      lineIndex: i,
      endLineIndex: i,
      indentSpaces,
      rawLine,
      attrs,
      children: []
    };

    while (stack.length > 0 && stack[stack.length - 1].indentSpaces >= indentSpaces) {
      stack.pop();
    }

    if (stack.length === 0) {
      topItems.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
      // Propagate endLineIndex up all ancestors in stack
      for (const anc of stack) {
        anc.endLineIndex = Math.max(anc.endLineIndex, i);
      }
    }

    stack.push(item);
  }

  // Empty document fallback
  if (topItems.length === 0) {
    return {
      id: 'root_0',
      lineIndex: 0,
      endLineIndex: 0,
      indentSpaces: 0,
      rawLine: fallbackDocTitle,
      text: fallbackDocTitle,
      tags: [],
      depth: 0,
      branchIndex: 0,
      direction: layoutMode === 'left' ? 'left' : layoutMode === 'top-down' ? 'down' : 'right',
      children: [],
      totalDescendants: 0
    };
  }

  // Determine root item: if single top-level item, use it directly as Root;
  // if multiple top-level items, create a virtual document root wrapping them.
  let rootRaw: RawParsedItem;
  if (topItems.length === 1) {
    rootRaw = topItems[0];
  } else {
    rootRaw = {
      lineIndex: -1,
      endLineIndex: rawLines.length - 1,
      indentSpaces: -2,
      rawLine: fallbackDocTitle,
      attrs: { text: fallbackDocTitle, tags: [] },
      children: topItems
    };
  }

  const enrich = (
    item: RawParsedItem,
    depth: number,
    branchIndex: number,
    direction: 'right' | 'left' | 'down',
    inheritedColor?: NodeColorKey
  ): OutlineNode => {
    const effectiveColor =
      item.attrs.color && item.attrs.color !== 'auto'
        ? item.attrs.color
        : inheritedColor;

    const children = item.children.map((child, idx) => {
      const childBranch = depth === 0 ? idx : branchIndex;
      let childDir: 'right' | 'left' | 'down' = direction;
      if (layoutMode === 'top-down') {
        childDir = 'down';
      } else if (layoutMode === 'left') {
        childDir = 'left';
      } else if (layoutMode === 'right') {
        childDir = 'right';
      } else if (layoutMode === 'balanced') {
        if (depth === 0) {
          // Even index right, odd index left (or first half right, second half left)
          childDir = idx % 2 === 0 ? 'right' : 'left';
        }
      }
      return enrich(child, depth + 1, childBranch, childDir, effectiveColor);
    });

    const totalDescendants = children.reduce(
      (sum, c) => sum + 1 + c.totalDescendants,
      0
    );

    return {
      id: item.lineIndex >= 0 ? `line_${item.lineIndex}` : 'virtual_root',
      lineIndex: item.lineIndex,
      endLineIndex: item.endLineIndex,
      indentSpaces: item.indentSpaces,
      rawLine: item.rawLine,
      text: item.attrs.text,
      checked: item.attrs.checked,
      tags: item.attrs.tags,
      url: item.attrs.url,
      note: item.attrs.note,
      color: effectiveColor,
      depth,
      branchIndex,
      direction,
      children,
      totalDescendants
    };
  };

  const rootDir =
    layoutMode === 'left' ? 'left' : layoutMode === 'top-down' ? 'down' : 'right';

  return enrich(rootRaw, 0, 0, rootDir, rootRaw.attrs.color);
}

/**
 * 根據行號在樹中尋找對應節點
 */
export function findNodeByLineIndex(
  root: OutlineNode,
  lineIndex: number
): OutlineNode | null {
  if (root.lineIndex === lineIndex) return root;
  for (const c of root.children) {
    const found = findNodeByLineIndex(c, lineIndex);
    if (found) return found;
  }
  return null;
}

/**
 * 尋找某節點的父節點
 */
export function findParentNode(
  root: OutlineNode,
  targetId: string
): OutlineNode | null {
  for (const c of root.children) {
    if (c.id === targetId) return root;
    const found = findParentNode(c, targetId);
    if (found) return found;
  }
  return null;
}

/**
 * 修改指定節點的文字或屬性（雙向同步寫回大綱文字）
 */
export function updateNodeInOutline(
  content: string,
  node: OutlineNode,
  patch: Partial<ParsedLineAttrs>
): { content: string; lineIndex: number } {
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  // If virtual root (-1), prepend a real root line and indent all existing non-empty lines by 2 spaces
  if (node.lineIndex < 0) {
    const newRootLine = composeOutlineLine(0, {
      text: patch.text ?? node.text,
      checked: patch.checked,
      tags: patch.tags ?? node.tags,
      color: patch.color,
      url: patch.url ?? node.url,
      note: patch.note ?? node.note
    });
    const shifted = lines.map((l) => (l.trim() ? '  ' + l : l));
    return {
      content: [newRootLine, ...shifted].join('\n'),
      lineIndex: 0
    };
  }

  const currentAttrs = parseLineAttributes(lines[node.lineIndex] || node.rawLine);
  const nextAttrs: ParsedLineAttrs = {
    text: patch.text !== undefined ? patch.text : currentAttrs.text,
    checked:
      'checked' in patch ? patch.checked : currentAttrs.checked,
    tags: patch.tags !== undefined ? patch.tags : currentAttrs.tags,
    color: 'color' in patch ? patch.color : currentAttrs.color,
    url: 'url' in patch ? patch.url : currentAttrs.url,
    note: 'note' in patch ? patch.note : currentAttrs.note
  };

  lines[node.lineIndex] = composeOutlineLine(node.indentSpaces, nextAttrs);
  return {
    content: lines.join('\n'),
    lineIndex: node.lineIndex
  };
}

/**
 * 在指定節點下新增子節點（回傳新文字與新增行的 lineIndex）
 */
export function addChildNodeInOutline(
  content: string,
  parentNode: OutlineNode,
  defaultText: string = '新分支節點'
): { content: string; insertedLineIndex: number } {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const allowEmpty = defaultText === '';

  // Empty doc edge case
  if (lines.length === 1 && !lines[0].trim()) {
    const rootLine = parentNode.text || '核心主題';
    const childLine = `  ${defaultText}`;
    return {
      content: `${rootLine}\n${childLine}`,
      insertedLineIndex: 1
    };
  }

  // Virtual root (-1): add a new top-level (indent 0) item at end of document
  if (parentNode.lineIndex < 0) {
    const newLine = composeOutlineLine(0, { text: defaultText, tags: [] }, allowEmpty);
    lines.push(newLine);
    return {
      content: lines.join('\n'),
      insertedLineIndex: lines.length - 1
    };
  }

  const childIndent =
    parentNode.children.length > 0
      ? parentNode.children[0].indentSpaces
      : Math.max(0, parentNode.indentSpaces) + 2;

  const insertAt = Math.min(lines.length, parentNode.endLineIndex + 1);
  const newLine = composeOutlineLine(childIndent, { text: defaultText, tags: [] }, allowEmpty);
  lines.splice(insertAt, 0, newLine);

  return {
    content: lines.join('\n'),
    insertedLineIndex: insertAt
  };
}

/**
 * 在指定節點下方新增同層級兄弟節點
 */
export function addSiblingNodeInOutline(
  content: string,
  node: OutlineNode,
  defaultText: string = '新同級節點'
): { content: string; insertedLineIndex: number } {
  // If root node (depth === 0), adding a sibling acts like adding a main branch child
  if (node.depth === 0) {
    return addChildNodeInOutline(content, node, defaultText);
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const allowEmpty = defaultText === '';
  const insertAt = Math.min(lines.length, node.endLineIndex + 1);
  const newLine = composeOutlineLine(node.indentSpaces, { text: defaultText, tags: [] }, allowEmpty);
  lines.splice(insertAt, 0, newLine);

  return {
    content: lines.join('\n'),
    insertedLineIndex: insertAt
  };
}

/**
 * 刪除指定節點及其整棵子樹
 */
export function deleteNodeSubtreeInOutline(
  content: string,
  node: OutlineNode
): { content: string; nextSelectLineIndex: number } {
  if (node.lineIndex < 0) {
    return { content, nextSelectLineIndex: 0 };
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const deleteCount = Math.max(1, node.endLineIndex - node.lineIndex + 1);

  // Prevent deleting the very last line completely; leave root topic if root deleted
  if (lines.length <= deleteCount) {
    return {
      content: '核心主題',
      nextSelectLineIndex: 0
    };
  }

  lines.splice(node.lineIndex, deleteCount);
  const nextLine = Math.max(0, Math.min(lines.length - 1, node.lineIndex - 1));
  return {
    content: lines.join('\n'),
    nextSelectLineIndex: nextLine
  };
}

/**
 * 上下移動當前節點及其整棵子樹（對應 Alt + ↑ / ↓ 快捷鍵）
 */
export function moveSubtreeVertical(
  content: string,
  rootNode: OutlineNode,
  lineIndex: number,
  direction: 'up' | 'down'
): { content: string; newLineIndex: number } | null {
  const target = findNodeByLineIndex(rootNode, lineIndex);
  if (!target || target.lineIndex < 0) return null;

  const parent = findParentNode(rootNode, target.id);
  if (!parent) return null;

  const siblings = parent.children;
  const idx = siblings.findIndex((s) => s.id === target.id);
  if (idx === -1) return null;

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return null;

  const other = siblings[swapIdx];
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  const targetBlock = lines.slice(target.lineIndex, target.endLineIndex + 1);
  const otherBlock = lines.slice(other.lineIndex, other.endLineIndex + 1);

  if (direction === 'up') {
    // other is above target
    lines.splice(
      other.lineIndex,
      target.endLineIndex - other.lineIndex + 1,
      ...targetBlock,
      ...otherBlock
    );
    return {
      content: lines.join('\n'),
      newLineIndex: other.lineIndex
    };
  } else {
    // target is above other
    lines.splice(
      target.lineIndex,
      other.endLineIndex - target.lineIndex + 1,
      ...otherBlock,
      ...targetBlock
    );
    return {
      content: lines.join('\n'),
      newLineIndex: target.lineIndex + otherBlock.length
    };
  }
}

/**
 * 拖曳節點改變父子階層或同層排序 (Drag & Drop Reparenting / Reordering)
 */
export function reparentOrReorderSubtree(
  content: string,
  sourceNode: OutlineNode,
  targetNode: OutlineNode,
  dropPosition: 'inside' | 'before' | 'after'
): { content: string; newLineIndex: number } | null {
  if (sourceNode.lineIndex < 0 || sourceNode.id === targetNode.id) return null;
  // Cannot drop a parent into its own descendant
  if (
    targetNode.lineIndex >= sourceNode.lineIndex &&
    targetNode.lineIndex <= sourceNode.endLineIndex
  ) {
    return null;
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const sourceCount = sourceNode.endLineIndex - sourceNode.lineIndex + 1;
  const rawSourceBlock = lines.slice(sourceNode.lineIndex, sourceNode.endLineIndex + 1);

  let desiredIndent = sourceNode.indentSpaces;
  if (dropPosition === 'inside') {
    desiredIndent =
      targetNode.lineIndex < 0
        ? 0
        : targetNode.children.length > 0
        ? targetNode.children[0].indentSpaces
        : Math.max(0, targetNode.indentSpaces) + 2;
  } else {
    desiredIndent = Math.max(0, targetNode.indentSpaces);
  }

  const indentDelta = desiredIndent - sourceNode.indentSpaces;
  const adjustedBlock = rawSourceBlock.map((l) => {
    if (!l.trim()) return l;
    const expanded = l.replace(/\t/g, '  ');
    const curIndent = expanded.match(/^\s*/)?.[0].length ?? 0;
    const nextIndent = Math.max(0, curIndent + indentDelta);
    return ' '.repeat(nextIndent) + expanded.trimStart();
  });

  // Remove source block first
  lines.splice(sourceNode.lineIndex, sourceCount);

  // Calculate adjusted target indices after removal
  const shift = sourceNode.lineIndex < targetNode.lineIndex ? -sourceCount : 0;
  let insertAt = 0;

  if (dropPosition === 'before') {
    insertAt = Math.max(0, targetNode.lineIndex + shift);
  } else if (dropPosition === 'after' || dropPosition === 'inside') {
    insertAt = Math.min(lines.length, targetNode.endLineIndex + shift + 1);
  }

  lines.splice(insertAt, 0, ...adjustedBlock);

  return {
    content: lines.join('\n'),
    newLineIndex: insertAt
  };
}

/**
 * 匯出為標準 Markdown 格式
 */
export function exportTreeToMarkdown(root: OutlineNode): string {
  const out: string[] = [];
  const walk = (n: OutlineNode) => {
    const checkStr =
      n.checked === true ? '[x] ' : n.checked === false ? '[ ] ' : '';
    const tagStr = n.tags.length > 0 ? ' ' + n.tags.map((t) => `\`#${t}\``).join(' ') : '';
    const linkStr = n.url ? ` ([連結](${n.url}))` : '';
    const noteStr = n.note ? ` — *${n.note}*` : '';

    if (n.depth === 0) {
      out.push(`# ${checkStr}${n.text}${tagStr}${linkStr}`);
      if (n.note) out.push(`> ${n.note}`);
      out.push('');
    } else if (n.depth === 1) {
      out.push(`## ${checkStr}${n.text}${tagStr}${linkStr}${noteStr}`);
    } else {
      const indent = '  '.repeat(Math.max(0, n.depth - 2));
      out.push(`${indent}- ${checkStr}${n.text}${tagStr}${linkStr}${noteStr}`);
    }

    for (const c of n.children) {
      walk(c);
    }
    if (n.depth === 1) out.push('');
  };
  walk(root);
  return out.join('\n').trim() + '\n';
}

/**
 * 匯出為 Mermaid mindmap 縮排格式
 */
export function exportTreeToMermaid(root: OutlineNode): string {
  const out: string[] = ['mindmap'];
  const walk = (n: OutlineNode) => {
    const indent = '  '.repeat(n.depth + 1);
    const safeLabel = n.text.replace(/[()[\]{}"]/g, ' ').trim();
    if (n.depth === 0) {
      out.push(`${indent}root((${safeLabel}))`);
    } else {
      out.push(`${indent}${safeLabel}`);
    }
    for (const c of n.children) {
      walk(c);
    }
  };
  walk(root);
  return out.join('\n') + '\n';
}

