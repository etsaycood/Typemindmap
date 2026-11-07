import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  DocumentTab,
  HistoryEntry,
  LayoutMode,
  OutlineNode,
  ThemeMode
} from './types/mindmap';
import {
  addChildNodeInOutline,
  addSiblingNodeInOutline,
  deleteNodeSubtreeInOutline,
  exportTreeToMarkdown,
  exportTreeToMermaid,
  findNodeByLineIndex,
  ParsedLineAttrs,
  parseOutlineToTree,
  reparentOrReorderSubtree,
  updateNodeInOutline
} from './utils/outlineEngine';
import { computeMindMapLayout } from './utils/layoutEngine';
import { MINDMAP_TEMPLATES, MindMapTemplate } from './utils/templates';
import {
  downloadTextFile,
  exportAsPngFile,
  exportAsSvgFile
} from './utils/exportHelper';
import { TopToolbar } from './components/TopToolbar';
import { MindMapCanvas } from './components/MindMapCanvas';
import { RightOutliner } from './components/RightOutliner';
import { NodeDetailModal } from './components/NodeDetailModal';
import { ShortcutsModal } from './components/ShortcutsModal';

const STORAGE_KEY = 'typemindmap_workspace_v1';

function collectExpandedByLevel(root: OutlineNode, level: number | 'all'): Set<string> {
  const set = new Set<string>();
  const walk = (n: OutlineNode) => {
    if (n.children.length > 0 && (level === 'all' || n.depth < level)) {
      set.add(n.id);
    }
    for (const c of n.children) walk(c);
  };
  walk(root);
  return set;
}

export default function App() {
  // Load initial workspace from localStorage
  const initialWorkspace = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
          return parsed as {
            tabs: DocumentTab[];
            activeTabId: string;
            theme: ThemeMode;
            rightWidthPercent: number;
          };
        }
      }
    } catch {
      // ignore
    }
    const defaultTpl = MINDMAP_TEMPLATES[0];
    const firstTab: DocumentTab = {
      id: 'tab_1',
      title: '產品規劃藍圖',
      content: defaultTpl.content,
      layoutMode: defaultTpl.layoutMode,
      updatedAt: Date.now()
    };
    return {
      tabs: [firstTab],
      activeTabId: firstTab.id,
      theme: 'dark' as ThemeMode,
      rightWidthPercent: 35
    };
  }, []);

  const [tabs, setTabs] = useState<DocumentTab[]>(initialWorkspace.tabs);
  const [activeTabId, setActiveTabId] = useState<string>(initialWorkspace.activeTabId);
  const [theme, setTheme] = useState<ThemeMode>(initialWorkspace.theme || 'dark');
  const [rightWidthPercent, setRightWidthPercent] = useState<number>(
    initialWorkspace.rightWidthPercent || 35
  );
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);

  // Undo / Redo History per Tab
  const [historyByTab, setHistoryByTab] = useState<
    Record<string, { past: HistoryEntry[]; future: HistoryEntry[] }>
  >({});

  const activeTab = useMemo(() => {
    return tabs.find((t) => t.id === activeTabId) || tabs[0];
  }, [tabs, activeTabId]);

  // Persist workspace automatically
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          tabs,
          activeTabId: activeTab.id,
          theme,
          rightWidthPercent
        })
      );
    } catch {
      // ignore quota error
    }
  }, [tabs, activeTab.id, theme, rightWidthPercent]);

  // Sync HTML root class for dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Cursor & Selection Sync States
  const [activeLineIndex, setActiveLineIndex] = useState<number>(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inlineEditState, setInlineEditState] = useState<{
    lineIndex: number;
    seq: number;
  } | null>(null);
  const [pendingNewNode, setPendingNewNode] = useState<{
    lineIndex: number;
    fallbackText: string;
  } | null>(null);
  const [centerNodeRequest, setCenterNodeRequest] = useState<{
    nodeId: string;
    seq: number;
  } | null>(null);
  const [externalJumpLine, setExternalJumpLine] = useState<{
    lineIndex: number;
    seq: number;
  } | null>(null);

  const seqRef = useRef<number>(1);
  const latestContentRef = useRef<string>(activeTab.content);
  latestContentRef.current = activeTab.content;
  const pendingNewNodeRef = useRef(pendingNewNode);
  pendingNewNodeRef.current = pendingNewNode;

  const inlineEditLineIndex = inlineEditState?.lineIndex ?? null;
  const inlineEditSeq = inlineEditState?.seq ?? 0;

  // Parse active tab content into Tree (keep newly created blank line visible while inline editing)
  const rootNode = useMemo(() => {
    return parseOutlineToTree(
      activeTab.content,
      activeTab.layoutMode,
      activeTab.title,
      pendingNewNode?.lineIndex ?? null
    );
  }, [activeTab.content, activeTab.layoutMode, activeTab.title, pendingNewNode?.lineIndex]);

  // Expand Preset & Expanded Node IDs (default: All or 3 levels so initial map looks rich, with easy 1/2/3/all toggle)
  const [expandPreset, setExpandPreset] = useState<number | 'all'>(2);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    collectExpandedByLevel(rootNode, 2)
  );

  // Keep newly created parent nodes expanded if within preset or explicitly opened
  const prevTabIdRef = useRef<string>(activeTab.id);
  useEffect(() => {
    if (prevTabIdRef.current !== activeTab.id) {
      prevTabIdRef.current = activeTab.id;
      setExpandedIds(collectExpandedByLevel(rootNode, expandPreset));
      setSelectedNodeId(null);
      setInlineEditState(null);
      setPendingNewNode(null);
      pendingNewNodeRef.current = null;
    }
  }, [activeTab.id, rootNode, expandPreset]);

  // Ensure root node is always expanded by default if it has children
  useEffect(() => {
    if (rootNode.children.length > 0 && !expandedIds.has(rootNode.id) && expandPreset !== 1) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(rootNode.id);
        return next;
      });
    }
  }, [rootNode.id, rootNode.children.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute Layout
  const layout = useMemo(() => {
    return computeMindMapLayout(rootNode, expandedIds, activeTab.layoutMode);
  }, [rootNode, expandedIds, activeTab.layoutMode]);

  // Modals
  const [detailModalNode, setDetailModalNode] = useState<OutlineNode | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

  const expandAncestorsOfLine = useCallback((tree: OutlineNode, lineIdx: number) => {
    const targetNode = findNodeByLineIndex(tree, lineIdx);
    if (!targetNode) return;
    const toExpand: string[] = [];
    const walkAncestors = (n: OutlineNode): boolean => {
      if (n.id === targetNode.id) return true;
      for (const c of n.children) {
        if (walkAncestors(c)) {
          toExpand.push(n.id);
          return true;
        }
      }
      return false;
    };
    walkAncestors(tree);
    if (toExpand.length > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const id of toExpand) next.add(id);
        return next;
      });
    }
  }, []);

  // Update Active Tab Content with History Recording
  const updateActiveContent = useCallback(
    (newContent: string, cursorLine?: number, recordHistory: boolean = true) => {
      const prevContent = latestContentRef.current;
      if (newContent === prevContent) {
        if (cursorLine !== undefined) setActiveLineIndex(cursorLine);
        return;
      }

      if (recordHistory) {
        setHistoryByTab((prev) => {
          const cur = prev[activeTab.id] || { past: [], future: [] };
          const nextPast = [
            ...cur.past.slice(-59),
            { content: prevContent, cursorLine: activeLineIndex }
          ];
          return {
            ...prev,
            [activeTab.id]: { past: nextPast, future: [] }
          };
        });
      }

      latestContentRef.current = newContent;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id
            ? { ...t, content: newContent, updatedAt: Date.now() }
            : t
        )
      );

      if (cursorLine !== undefined) {
        setActiveLineIndex(cursorLine);
      }
    },
    [activeTab.id, activeLineIndex]
  );

  // Undo & Redo
  const tabHistory = historyByTab[activeTab.id] || { past: [], future: [] };
  const canUndo = tabHistory.past.length > 0;
  const canRedo = tabHistory.future.length > 0;

  const handleUndo = useCallback(() => {
    const cur = historyByTab[activeTab.id];
    if (!cur || cur.past.length === 0) return;
    const previous = cur.past[cur.past.length - 1];
    const newPast = cur.past.slice(0, -1);
    const newFuture = [{ content: latestContentRef.current, cursorLine: activeLineIndex }, ...cur.future];

    setInlineEditState(null);
    setPendingNewNode(null);
    pendingNewNodeRef.current = null;

    setHistoryByTab((prev) => ({
      ...prev,
      [activeTab.id]: { past: newPast, future: newFuture }
    }));

    latestContentRef.current = previous.content;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, content: previous.content, updatedAt: Date.now() } : t
      )
    );
    if (previous.cursorLine !== undefined) {
      setActiveLineIndex(previous.cursorLine);
    }
  }, [historyByTab, activeTab.id, activeLineIndex]);

  const handleRedo = useCallback(() => {
    const cur = historyByTab[activeTab.id];
    if (!cur || cur.future.length === 0) return;
    const nextEntry = cur.future[0];
    const newFuture = cur.future.slice(1);
    const newPast = [...cur.past, { content: latestContentRef.current, cursorLine: activeLineIndex }];

    setInlineEditState(null);
    setPendingNewNode(null);
    pendingNewNodeRef.current = null;

    setHistoryByTab((prev) => ({
      ...prev,
      [activeTab.id]: { past: newPast, future: newFuture }
    }));

    latestContentRef.current = nextEntry.content;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, content: nextEntry.content, updatedAt: Date.now() } : t
      )
    );
    if (nextEntry.cursorLine !== undefined) {
      setActiveLineIndex(nextEntry.cursorLine);
    }
  }, [historyByTab, activeTab.id, activeLineIndex]);

  // Global Ctrl+Z / Ctrl+Y listener
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [handleUndo, handleRedo]);

  const handleStartInlineEdit = (lineIndex: number | null) => {
    if (lineIndex === null) {
      setInlineEditState(null);
      return;
    }
    const seq = ++seqRef.current;
    setInlineEditState({ lineIndex, seq });
  };

  const spawnNewNodeOnCanvas = (
    baseContent: string,
    targetNode: OutlineNode,
    kind: 'child' | 'sibling'
  ) => {
    const fallbackText =
      kind === 'child' || targetNode.depth === 0 ? '新分支' : '新節點';
    const res =
      kind === 'child'
        ? addChildNodeInOutline(baseContent, targetNode, '')
        : addSiblingNodeInOutline(baseContent, targetNode, '');

    updateActiveContent(res.content, res.insertedLineIndex, true);

    const pending = { lineIndex: res.insertedLineIndex, fallbackText };
    pendingNewNodeRef.current = pending;
    setPendingNewNode(pending);

    const nextTree = parseOutlineToTree(
      res.content,
      activeTab.layoutMode,
      activeTab.title,
      res.insertedLineIndex
    );
    expandAncestorsOfLine(nextTree, res.insertedLineIndex);

    const newNodeId = `line_${res.insertedLineIndex}`;
    const seq = ++seqRef.current;
    setSelectedNodeId(newNodeId);
    setInlineEditState({ lineIndex: res.insertedLineIndex, seq });
    setCenterNodeRequest({ nodeId: newNodeId, seq });
    setExternalJumpLine({ lineIndex: res.insertedLineIndex, seq });
  };

  // Graphic Node Mutation Handlers (Two-Way Sync!)
  const handleSelectNodeOnCanvas = (node: OutlineNode | null) => {
    if (!node) {
      setSelectedNodeId(null);
      return;
    }
    setSelectedNodeId(node.id);
    if (node.lineIndex >= 0) {
      setActiveLineIndex(node.lineIndex);
      setExternalJumpLine({ lineIndex: node.lineIndex, seq: ++seqRef.current });
    }
  };

  const handleUpdateNodeOnCanvas = (node: OutlineNode, patch: Partial<ParsedLineAttrs>) => {
    const res = updateNodeInOutline(latestContentRef.current, node, patch);
    updateActiveContent(res.content, res.lineIndex, true);
    if (node.lineIndex < 0) {
      setSelectedNodeId(`line_${res.lineIndex}`);
    }
  };

  const handleCommitInlineEdit = (
    node: OutlineNode,
    draftText: string,
    mode: 'commit' | 'cancel' | 'addChild' | 'addSibling' = 'commit'
  ) => {
    const curPending = pendingNewNodeRef.current;
    const isPendingNew = curPending !== null && curPending.lineIndex === node.lineIndex;
    const trimmed = draftText.trim();

    let finalText: string;
    if (mode === 'cancel' && !isPendingNew) {
      finalText = node.text || '未命名節點';
    } else if (trimmed.length > 0) {
      finalText = trimmed;
    } else if (isPendingNew) {
      finalText = curPending.fallbackText;
    } else {
      finalText = node.text || '未命名節點';
    }

    const step1 = updateNodeInOutline(latestContentRef.current, node, { text: finalText });
    // If finalizing a newly inserted blank node, update content in-place without adding an extra blank-line history step
    updateActiveContent(step1.content, step1.lineIndex, !isPendingNew);

    pendingNewNodeRef.current = null;
    setPendingNewNode(null);

    if (mode === 'addChild' || mode === 'addSibling') {
      const updatedTree = parseOutlineToTree(
        step1.content,
        activeTab.layoutMode,
        activeTab.title
      );
      const updatedNode = findNodeByLineIndex(updatedTree, step1.lineIndex) || node;
      spawnNewNodeOnCanvas(
        step1.content,
        updatedNode,
        mode === 'addChild' ? 'child' : 'sibling'
      );
      return;
    }

    setInlineEditState(null);
    setSelectedNodeId(`line_${step1.lineIndex}`);
  };

  const handleAddChildOnCanvas = (parentNode: OutlineNode) => {
    spawnNewNodeOnCanvas(latestContentRef.current, parentNode, 'child');
  };

  const handleAddSiblingOnCanvas = (node: OutlineNode) => {
    spawnNewNodeOnCanvas(latestContentRef.current, node, 'sibling');
  };

  const handleDeleteNodeOnCanvas = (node: OutlineNode) => {
    pendingNewNodeRef.current = null;
    setPendingNewNode(null);
    setInlineEditState(null);
    const res = deleteNodeSubtreeInOutline(latestContentRef.current, node);
    updateActiveContent(res.content, res.nextSelectLineIndex, true);
    setSelectedNodeId(`line_${res.nextSelectLineIndex}`);
  };

  const handleReparentOrReorder = (
    source: OutlineNode,
    target: OutlineNode,
    pos: 'inside' | 'before' | 'after'
  ) => {
    const res = reparentOrReorderSubtree(latestContentRef.current, source, target, pos);
    if (!res) return;
    updateActiveContent(res.content, res.newLineIndex, true);
    if (pos === 'inside') {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(target.id);
        return next;
      });
    }
    setSelectedNodeId(`line_${res.newLineIndex}`);
  };

  const handleToggleExpand = (nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleExpandNodeForce = (nodeId: string) => {
    setExpandedIds((prev) => {
      if (prev.has(nodeId)) return prev;
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });
  };

  const handleChangeExpandPreset = (preset: number | 'all') => {
    setExpandPreset(preset);
    setExpandedIds(collectExpandedByLevel(rootNode, preset));
  };

  // When user types a deeper line in the right outliner, auto-expand its ancestors and center newly added/indented nodes!
  const handleOutlinerContentChange = (
    newContent: string,
    nextCursorLine?: number,
    triggerCenter?: boolean
  ) => {
    const hadNodeBefore =
      nextCursorLine !== undefined ? findNodeByLineIndex(rootNode, nextCursorLine) !== null : true;

    if (pendingNewNodeRef.current) {
      pendingNewNodeRef.current = null;
      setPendingNewNode(null);
    }

    updateActiveContent(newContent, nextCursorLine, true);

    if (nextCursorLine !== undefined) {
      const nextTree = parseOutlineToTree(newContent, activeTab.layoutMode, activeTab.title);
      const addedOrEdited = findNodeByLineIndex(nextTree, nextCursorLine);
      if (addedOrEdited) {
        expandAncestorsOfLine(nextTree, nextCursorLine);
        if (triggerCenter || !hadNodeBefore) {
          const seq = ++seqRef.current;
          setCenterNodeRequest({ nodeId: addedOrEdited.id, seq });
        }
      }
    }
  };

  // Tab Management
  const handleAddTab = () => {
    const idx = tabs.length + 1;
    const newTab: DocumentTab = {
      id: `tab_${Date.now()}`,
      title: `未命名導圖 ${idx}`,
      content: `核心主題 ${idx}\n  第一分支\n    子項目 A\n    子項目 B\n  第二分支\n    [ ] 待辦事項 #重點`,
      layoutMode: 'right',
      updatedAt: Date.now()
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleSelectTemplate = (tpl: MindMapTemplate) => {
    const newTab: DocumentTab = {
      id: `tab_${Date.now()}`,
      title: tpl.name.replace(/^[^\s]+\s*/, ''),
      content: tpl.content,
      layoutMode: tpl.layoutMode,
      updatedAt: Date.now()
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleRenameTab = (tabId: string, newTitle: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, title: newTitle } : t))
    );
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === tabId);
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      const nextTab = remaining[Math.max(0, idx - 1)];
      setActiveTabId(nextTab.id);
    }
  };

  const handleChangeLayout = (mode: LayoutMode) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, layoutMode: mode } : t))
    );
  };

  // Split Resizer between Left Canvas and Right Outliner
  const mainRef = useRef<HTMLElement>(null);
  const startResizeSplit = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startRightPct = rightWidthPercent;
    const totalW = mainRef.current?.clientWidth || 1200;

    const onMove = (ev: MouseEvent) => {
      const dx = startX - ev.clientX; // dragging left increases right panel width
      const deltaPct = (dx / totalW) * 100;
      setRightWidthPercent(Math.min(60, Math.max(22, startRightPct + deltaPct)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Export / Import Handlers
  const handleExportPng = () => {
    exportAsPngFile(layout, theme, activeTab.title).catch((err) =>
      alert(err.message || '匯出 PNG 失敗')
    );
  };

  const handleExportSvg = () => {
    exportAsSvgFile(layout, theme, activeTab.title);
  };

  const handleExportMarkdown = () => {
    downloadTextFile(
      `${activeTab.title}.md`,
      exportTreeToMarkdown(rootNode),
      'text/markdown;charset=utf-8'
    );
  };

  const handleExportMermaid = () => {
    downloadTextFile(
      `${activeTab.title}.mmd`,
      exportTreeToMermaid(rootNode),
      'text/plain;charset=utf-8'
    );
  };

  const handleExportTxt = () => {
    downloadTextFile(`${activeTab.title}.txt`, activeTab.content);
  };

  const handleExportJson = () => {
    const payload = JSON.stringify(
      {
        app: 'Typemindmap',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        tabs
      },
      null,
      2
    );
    downloadTextFile('typemindmap_workspace.json', payload, 'application/json;charset=utf-8');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
          setTabs(parsed.tabs);
          setActiveTabId(parsed.tabs[0].id);
        } else {
          alert('JSON 格式不包含有效的 Typemindmap 分頁資料');
        }
      } catch {
        alert('無法解析 JSON 備份檔');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className={`flex flex-col w-screen h-screen overflow-hidden ${
        theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Toolbar */}
      <TopToolbar
        theme={theme}
        layoutMode={activeTab.layoutMode}
        expandPreset={expandPreset}
        canUndo={canUndo}
        canRedo={canRedo}
        isRightPanelOpen={isRightPanelOpen}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onChangeLayout={handleChangeLayout}
        onChangeExpandPreset={handleChangeExpandPreset}
        onSelectTemplate={handleSelectTemplate}
        onExportPng={handleExportPng}
        onExportSvg={handleExportSvg}
        onExportMarkdown={handleExportMarkdown}
        onExportMermaid={handleExportMermaid}
        onExportTxt={handleExportTxt}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onToggleRightPanel={() => setIsRightPanelOpen((v) => !v)}
      />

      {/* Main Split Workspace: Left MindMap Canvas + Right Keyboard Outliner */}
      <main ref={mainRef} className="flex-1 flex w-full min-h-0 relative overflow-hidden">
        {/* Left: Visual MindMap Canvas */}
        <section
          className="h-full min-w-0 overflow-hidden"
          style={{
            width: isRightPanelOpen ? `${100 - rightWidthPercent}%` : '100%'
          }}
        >
          <MindMapCanvas
            rootNode={rootNode}
            layout={layout}
            layoutMode={activeTab.layoutMode}
            theme={theme}
            activeLineIndex={activeLineIndex}
            selectedNodeId={selectedNodeId}
            inlineEditLineIndex={inlineEditLineIndex}
            inlineEditSeq={inlineEditSeq}
            centerNodeRequest={centerNodeRequest}
            onSelectNode={handleSelectNodeOnCanvas}
            onStartInlineEdit={handleStartInlineEdit}
            onCommitInlineEdit={handleCommitInlineEdit}
            onUpdateNode={handleUpdateNodeOnCanvas}
            onAddChild={handleAddChildOnCanvas}
            onAddSibling={handleAddSiblingOnCanvas}
            onDeleteNode={handleDeleteNodeOnCanvas}
            onToggleExpand={handleToggleExpand}
            onExpandNodeForce={handleExpandNodeForce}
            onReparentOrReorder={handleReparentOrReorder}
            onOpenNodeDetail={(node) => setDetailModalNode(node)}
          />
        </section>

        {/* Center Draggable Splitter & Right Outliner Editor */}
        {isRightPanelOpen && (
          <>
            <div
              onMouseDown={startResizeSplit}
              className={`w-2 h-full cursor-col-resize flex items-center justify-center z-30 transition-colors group ${
                theme === 'dark'
                  ? 'bg-slate-900 hover:bg-cyan-500/30'
                  : 'bg-slate-200 hover:bg-cyan-500/30'
              }`}
              title="拖曳調整左側心智圖與右側打字區寬度比例"
            >
              <div className="w-0.5 h-10 rounded-full bg-slate-600 group-hover:bg-cyan-400 transition-colors" />
            </div>

            <section
              className="h-full min-w-[260px] overflow-hidden"
              style={{ width: `${rightWidthPercent}%` }}
            >
              <RightOutliner
                tabs={tabs}
                activeTabId={activeTab.id}
                content={activeTab.content}
                rootNode={rootNode}
                activeLineIndex={activeLineIndex}
                theme={theme}
                onSelectTab={setActiveTabId}
                onAddTab={handleAddTab}
                onRenameTab={handleRenameTab}
                onCloseTab={handleCloseTab}
                onChangeContent={handleOutlinerContentChange}
                onActiveLineChange={setActiveLineIndex}
                externalJumpLine={externalJumpLine}
              />
            </section>
          </>
        )}
      </main>

      {/* Node Detail Modal */}
      <NodeDetailModal
        node={detailModalNode}
        theme={theme}
        onClose={() => setDetailModalNode(null)}
        onSave={handleUpdateNodeOnCanvas}
      />

      {/* Keyboard Shortcuts & Syntax Guide Modal */}
      <ShortcutsModal
        isOpen={shortcutsOpen}
        theme={theme}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}

