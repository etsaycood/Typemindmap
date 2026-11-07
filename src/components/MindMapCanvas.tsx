import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutMode, OutlineNode, ThemeMode } from '../types/mindmap';
import {
  COLOR_PALETTES,
  MindMapLayoutResult,
  PositionedMindNode,
  resolveNodePalette
} from '../utils/layoutEngine';
import { ParsedLineAttrs } from '../utils/outlineEngine';
import {
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Focus,
  Trash2,
  SlidersHorizontal,
  CheckSquare,
  Square,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Pencil,
  Check,
  X
} from 'lucide-react';

interface MindMapCanvasProps {
  rootNode: OutlineNode;
  layout: MindMapLayoutResult;
  layoutMode: LayoutMode;
  theme: ThemeMode;
  activeLineIndex: number;
  selectedNodeId: string | null;
  inlineEditLineIndex: number | null;
  inlineEditSeq: number;
  centerNodeRequest?: { nodeId: string; seq: number } | null;
  onSelectNode: (node: OutlineNode | null) => void;
  onStartInlineEdit: (lineIndex: number | null) => void;
  onCommitInlineEdit: (
    node: OutlineNode,
    draftText: string,
    mode?: 'commit' | 'cancel' | 'addChild' | 'addSibling'
  ) => void;
  onUpdateNode: (node: OutlineNode, patch: Partial<ParsedLineAttrs>) => void;
  onAddChild: (node: OutlineNode) => void;
  onAddSibling: (node: OutlineNode) => void;
  onDeleteNode: (node: OutlineNode) => void;
  onToggleExpand: (nodeId: string) => void;
  onExpandNodeForce: (nodeId: string) => void;
  onReparentOrReorder: (
    source: OutlineNode,
    target: OutlineNode,
    pos: 'inside' | 'before' | 'after'
  ) => void;
  onOpenNodeDetail: (node: OutlineNode) => void;
}

export const MindMapCanvas: React.FC<MindMapCanvasProps> = ({
  layout,
  layoutMode,
  theme,
  activeLineIndex,
  selectedNodeId,
  inlineEditLineIndex,
  inlineEditSeq,
  centerNodeRequest,
  onSelectNode,
  onStartInlineEdit,
  onCommitInlineEdit,
  onUpdateNode,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onToggleExpand,
  onExpandNodeForce,
  onReparentOrReorder,
  onOpenNodeDetail
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const smoothTimerRef = useRef<number | null>(null);

  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 80, y: 240 });
  const [zoom, setZoom] = useState<number>(0.95);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [smoothAnim, setSmoothAnim] = useState<boolean>(false);
  const panStartRef = useRef({ clientX: 0, clientY: 0, panX: 0, panY: 0 });
  const didPanMoveRef = useRef(false);

  // Inline Editing Draft Text & Guards
  const [inlineDraft, setInlineDraft] = useState<string>('');
  const committedEditRef = useRef<boolean>(false);
  const initializedEditSeqRef = useRef<number>(0);

  // Top-Left Search & iPad PencilKit-style Node Tool Capsule
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toolPillOpen, setToolPillOpen] = useState<boolean>(false);
  const [colorPopoverOpen, setColorPopoverOpen] = useState<boolean>(false);

  // Focus Node Mode & Center-on-New-Node Request
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const pendingFocusIdRef = useRef<string | null>(null);
  const pendingCenterNodeIdRef = useRef<string | null>(null);
  const lastCenteredSeqRef = useRef<number>(0);

  // Drag-and-Drop Node Reparenting State
  const [draggingNode, setDraggingNode] = useState<OutlineNode | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    nodeId: string;
    pos: 'inside' | 'before' | 'after';
  } | null>(null);

  const isDark = theme === 'dark';

  const triggerSmoothAnim = useCallback((durationMs: number = 320) => {
    if (smoothTimerRef.current !== null) {
      window.clearTimeout(smoothTimerRef.current);
    }
    setSmoothAnim(true);
    smoothTimerRef.current = window.setTimeout(() => {
      setSmoothAnim(false);
      smoothTimerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (smoothTimerRef.current !== null) {
        window.clearTimeout(smoothTimerRef.current);
      }
    };
  }, []);

  // Close color popover if selection is cleared
  useEffect(() => {
    if (!selectedNodeId) {
      setColorPopoverOpen(false);
    }
  }, [selectedNodeId]);

  // Fit entire mindmap into viewport
  const fitToView = useCallback(
    (animate: boolean = true) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const vw = vp.clientWidth || 700;
      const vh = vp.clientHeight || 500;

      const padX = 72;
      const padY = 80;
      const scaleX = Math.max(200, vw - padX * 2) / (layout.bounds.width + 40);
      const scaleY = Math.max(160, vh - padY * 2) / (layout.bounds.height + 40);
      const nextZoom = Math.min(1.15, Math.max(0.28, Math.min(scaleX, scaleY)));

      const cx = (layout.bounds.minX + layout.bounds.maxX) / 2;
      const cy = (layout.bounds.minY + layout.bounds.maxY) / 2;

      if (animate) {
        triggerSmoothAnim(320);
      }
      setZoom(nextZoom);
      setPan({
        x: vw / 2 - cx * nextZoom,
        y: vh / 2 - cy * nextZoom
      });
      setFocusedNodeId(null);
    },
    [layout.bounds, triggerSmoothAnim]
  );

  // Initial fit & refit when layoutMode changes
  useEffect(() => {
    const t = window.setTimeout(() => fitToView(true), 40);
    return () => clearTimeout(t);
  }, [layoutMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate inline input when inlineEditLineIndex / inlineEditSeq becomes active
  useEffect(() => {
    if (inlineEditLineIndex === null) {
      initializedEditSeqRef.current = 0;
      return;
    }
    if (initializedEditSeqRef.current === inlineEditSeq) return;
    const target = layout.nodes.find((p) => p.node.lineIndex === inlineEditLineIndex);
    if (!target) return;

    initializedEditSeqRef.current = inlineEditSeq;
    committedEditRef.current = false;
    setInlineDraft(target.node.text);
    window.requestAnimationFrame(() => {
      const inputEl = inlineInputRef.current;
      if (!inputEl) return;
      inputEl.focus({ preventScroll: true });
      if (target.node.text.length > 0) {
        inputEl.select();
      }
    });
  }, [inlineEditLineIndex, inlineEditSeq, layout.nodes]);

  // Smoothly pan viewport to center newly created node (Tab / Enter)
  useEffect(() => {
    if (!centerNodeRequest || centerNodeRequest.seq === lastCenteredSeqRef.current) return;
    lastCenteredSeqRef.current = centerNodeRequest.seq;
    pendingCenterNodeIdRef.current = centerNodeRequest.nodeId;
  }, [centerNodeRequest]);

  useEffect(() => {
    const cid = pendingCenterNodeIdRef.current;
    if (!cid) return;
    const vp = viewportRef.current;
    if (!vp) return;

    const targetPos = layout.nodes.find((p) => p.node.id === cid);
    if (!targetPos) return;

    pendingCenterNodeIdRef.current = null;
    const vw = vp.clientWidth || 700;
    const vh = vp.clientHeight || 500;
    const nextZoom = zoom < 0.72 ? 0.85 : zoom;

    triggerSmoothAnim(300);
    if (nextZoom !== zoom) {
      setZoom(nextZoom);
    }
    setPan({
      x: vw / 2 - targetPos.centerX * nextZoom,
      y: vh / 2 - targetPos.centerY * nextZoom
    });
  }, [centerNodeRequest, layout, zoom, triggerSmoothAnim]);

  // Execute focus zoom after node expansion finishes layout
  useEffect(() => {
    const fid = pendingFocusIdRef.current;
    if (!fid) return;
    pendingFocusIdRef.current = null;

    const vp = viewportRef.current;
    if (!vp) return;
    const vw = vp.clientWidth || 700;
    const vh = vp.clientHeight || 500;

    const targetPos = layout.nodes.find((p) => p.node.id === fid);
    if (!targetPos) return;

    const childrenPos = layout.nodes.filter((p) =>
      targetPos.node.children.some((c) => c.id === p.node.id)
    );

    let minX = targetPos.x;
    let maxX = targetPos.x + targetPos.width;
    let minY = targetPos.y;
    let maxY = targetPos.y + targetPos.height;

    for (const cp of childrenPos) {
      minX = Math.min(minX, cp.x);
      maxX = Math.max(maxX, cp.x + cp.width);
      minY = Math.min(minY, cp.y);
      maxY = Math.max(maxY, cp.y + cp.height);
    }

    const boxW = Math.max(260, maxX - minX + 120);
    const boxH = Math.max(180, maxY - minY + 120);
    const nextZoom = Math.min(1.45, Math.max(0.85, Math.min(vw / boxW, vh / boxH)));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    triggerSmoothAnim(350);
    setZoom(nextZoom);
    setPan({
      x: vw / 2 - cx * nextZoom,
      y: vh / 2 - cy * nextZoom
    });
  }, [layout, triggerSmoothAnim]);

  const handleFocusNode = (node: OutlineNode) => {
    setFocusedNodeId(node.id);
    pendingFocusIdRef.current = node.id;
    onSelectNode(node);
    if (node.children.length > 0) {
      onExpandNodeForce(node.id);
    }
    // Trigger immediately in case already expanded
    const vp = viewportRef.current;
    const targetPos = layout.nodes.find((p) => p.node.id === node.id);
    if (vp && targetPos && (node.children.length === 0 || targetPos.isExpanded)) {
      pendingFocusIdRef.current = null;
      const vw = vp.clientWidth || 700;
      const vh = vp.clientHeight || 500;
      const childrenPos = layout.nodes.filter((p) =>
        node.children.some((c) => c.id === p.node.id)
      );
      let minX = targetPos.x;
      let maxX = targetPos.x + targetPos.width;
      let minY = targetPos.y;
      let maxY = targetPos.y + targetPos.height;
      for (const cp of childrenPos) {
        minX = Math.min(minX, cp.x);
        maxX = Math.max(maxX, cp.x + cp.width);
        minY = Math.min(minY, cp.y);
        maxY = Math.max(maxY, cp.y + cp.height);
      }
      const nextZoom = Math.min(
        1.45,
        Math.max(0.85, Math.min(vw / (maxX - minX + 140), vh / (maxY - minY + 140)))
      );
      triggerSmoothAnim(350);
      setZoom(nextZoom);
      setPan({
        x: vw / 2 - ((minX + maxX) / 2) * nextZoom,
        y: vh / 2 - ((minY + maxY) / 2) * nextZoom
      });
    }
  };

  // Keyboard shortcuts when canvas/node is selected (and not typing inside an input/textarea)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'textarea' || activeTag === 'input') return;
      if (!selectedNodeId) return;

      const selectedPos = layout.nodes.find((p) => p.node.id === selectedNodeId);
      if (!selectedPos) return;
      const node = selectedPos.node;

      if (e.key === 'Tab') {
        e.preventDefault();
        onAddChild(node);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onAddSibling(node);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteNode(node);
      } else if (e.key === 'F2' || e.key === ' ') {
        e.preventDefault();
        setInlineDraft(node.text);
        onStartInlineEdit(node.lineIndex);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, layout.nodes, onAddChild, onAddSibling, onDeleteNode, onStartInlineEdit]);

  // Wheel Zoom centered at cursor
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const nextZoom = Math.min(2.5, Math.max(0.22, zoom * factor));

    const wx = (mx - pan.x) / zoom;
    const wy = (my - pan.y) / zoom;

    setSmoothAnim(false);
    setZoom(nextZoom);
    setPan({
      x: mx - wx * nextZoom,
      y: my - wy * nextZoom
    });
  };

  // Canvas Background Panning
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Middle mouse click re-centers view (just like txt2map.com!)
    if (e.button === 1) {
      e.preventDefault();
      fitToView(true);
      return;
    }
    if ((e.target as HTMLElement).closest('[data-mind-node], button, input')) {
      return;
    }
    setIsPanning(true);
    setSmoothAnim(false);
    didPanMoveRef.current = false;
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: pan.x,
      panY: pan.y
    };
  };

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didPanMoveRef.current = true;
      }
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy
      });
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPanning]);

  const finishInlineEdit = (
    node: OutlineNode,
    mode: 'commit' | 'cancel' | 'addChild' | 'addSibling' = 'commit'
  ) => {
    if (committedEditRef.current) return;
    committedEditRef.current = true;
    onCommitInlineEdit(node, inlineDraft, mode);
  };

  const handleZoomStep = (factor: number) => {
    const vp = viewportRef.current;
    const cx = (vp?.clientWidth || 700) / 2;
    const cy = (vp?.clientHeight || 500) / 2;
    const nextZoom = Math.min(2.5, Math.max(0.22, zoom * factor));
    const wx = (cx - pan.x) / zoom;
    const wy = (cy - pan.y) / zoom;
    triggerSmoothAnim(240);
    setZoom(nextZoom);
    setPan({ x: cx - wx * nextZoom, y: cy - wy * nextZoom });
  };

  const selectedPositioned: PositionedMindNode | undefined = layout.nodes.find(
    (p) => p.node.id === selectedNodeId
  );
  const selectedPalette = selectedPositioned
    ? resolveNodePalette(selectedPositioned.node)
    : null;
  const selectedHasMeta = Boolean(
    selectedPositioned &&
      (selectedPositioned.node.note ||
        selectedPositioned.node.url ||
        selectedPositioned.node.tags.length > 0)
  );

  return (
    <div
      ref={viewportRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        if (
          !didPanMoveRef.current &&
          !(e.target as HTMLElement).closest('[data-mind-node], button, input')
        ) {
          setColorPopoverOpen(false);
          onSelectNode(null);
        }
      }}
      className={`relative w-full h-full overflow-hidden select-none ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      } ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
      style={{
        backgroundImage: isDark
          ? 'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.14) 1px, transparent 0)'
          : 'radial-gradient(circle at 1px 1px, rgba(100, 116, 139, 0.18) 1px, transparent 0)',
        backgroundSize: '24px 24px'
      }}
    >
      {/* Top-Left Search + iPad PencilKit-Style Node Action Capsule */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-2.5 flex-wrap pointer-events-none">
        {/* Search Pill */}
        <div className="pointer-events-auto">
          {searchOpen ? (
            <div
              className={`h-9 flex items-center gap-2 px-3.5 rounded-full border shadow-lg backdrop-blur-xl animate-fade-in ${
                isDark
                  ? 'bg-slate-900/92 border-cyan-500/45 text-white shadow-black/40'
                  : 'bg-white/92 border-cyan-500/50 text-slate-800 shadow-slate-300/60'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋節點文字或標籤..."
                autoFocus
                className="bg-transparent text-xs focus:outline-none w-40 sm:w-44"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchOpen(false);
                }}
                className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                  isDark
                    ? 'text-slate-400 hover:bg-slate-800 hover:text-rose-400'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-rose-500'
                }`}
                title="關閉搜尋"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={`h-9 flex items-center gap-1.5 px-3.5 rounded-full border text-xs font-medium shadow-md backdrop-blur-xl transition-all hover:scale-[1.02] active:scale-95 ${
                isDark
                  ? 'bg-slate-900/88 hover:bg-slate-800/95 border-slate-700/80 text-slate-200 shadow-black/35'
                  : 'bg-white/90 hover:bg-white border-slate-200/90 text-slate-700 shadow-slate-300/50'
              }`}
              title="搜尋地圖節點"
            >
              <Search className="w-3.5 h-3.5 text-cyan-500" />
              <span>搜尋節點</span>
            </button>
          )}
        </div>

        {/* Fixed iPad PencilKit-Style Node Quick Tool Capsule (next to Search) */}
        {selectedPositioned && selectedPalette && (
          <div
            data-mind-node="toolbar"
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto relative"
          >
            {!toolPillOpen ? (
              <button
                type="button"
                onClick={() => setToolPillOpen(true)}
                className={`group relative w-9 h-9 rounded-full border shadow-lg backdrop-blur-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 animate-fade-in ${
                  isDark
                    ? 'bg-slate-900/90 hover:bg-slate-800/95 border-slate-700/80 text-slate-100'
                    : 'bg-white/92 hover:bg-white border-slate-200/90 text-slate-700'
                }`}
                style={{
                  boxShadow: `0 0 0 2px ${selectedPalette.hex}55, 0 8px 20px -4px rgba(0, 0, 0, 0.28)`
                }}
                title="展開節點工具筆盒（換色、新增、待辦、聚焦、刪除）"
              >
                <Pencil className="w-4 h-4 transition-transform duration-200 group-hover:-rotate-12" />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: selectedPalette.hex,
                    boxShadow: isDark ? '0 0 0 2px #0f172a' : '0 0 0 2px #ffffff'
                  }}
                />
              </button>
            ) : (
              <div
                className={`relative h-9 px-1.5 rounded-full border shadow-xl backdrop-blur-xl flex items-center gap-0.5 animate-fade-in ${
                  isDark
                    ? 'bg-slate-900/92 border-slate-700/80 text-slate-200 shadow-black/45'
                    : 'bg-white/94 border-slate-200/90 text-slate-700 shadow-slate-300/70'
                }`}
              >
                {/* Minimize Back to Single Pencil Circle */}
                <button
                  type="button"
                  onClick={() => {
                    setToolPillOpen(false);
                    setColorPopoverOpen(false);
                  }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                    isDark
                      ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                      : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
                  }`}
                  title="收合為單一畫筆圖示"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                <div
                  className={`w-px h-4 mx-0.5 ${
                    isDark ? 'bg-slate-700/70' : 'bg-slate-200'
                  }`}
                />

                {/* Color Well Swatch (Merged 6+ Colors into 1 Circle) */}
                <button
                  type="button"
                  onClick={() => setColorPopoverOpen((v) => !v)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${
                    colorPopoverOpen ? (isDark ? 'bg-slate-800' : 'bg-slate-100') : ''
                  }`}
                  title="切換節點分支色彩"
                >
                  <span
                    className="w-4 h-4 rounded-full ring-2 ring-white/90 shadow-sm"
                    style={{ backgroundColor: selectedPalette.hex }}
                  />
                </button>

                {/* Add Child Node (Tab) */}
                <button
                  type="button"
                  onClick={() => {
                    setColorPopoverOpen(false);
                    onAddChild(selectedPositioned.node);
                  }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    isDark
                      ? 'text-cyan-400 hover:bg-cyan-500/20'
                      : 'text-cyan-600 hover:bg-cyan-50'
                  }`}
                  title="新增子節點 (Tab)"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Add Sibling Node (Enter) */}
                {selectedPositioned.node.depth > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setColorPopoverOpen(false);
                      onAddSibling(selectedPositioned.node);
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                      isDark
                        ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title="新增同級節點 (Enter)"
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Toggle Todo Checkbox */}
                <button
                  type="button"
                  onClick={() => {
                    setColorPopoverOpen(false);
                    const cur = selectedPositioned.node.checked;
                    const next =
                      cur === undefined ? false : cur === false ? true : undefined;
                    onUpdateNode(selectedPositioned.node, { checked: next });
                  }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    selectedPositioned.node.checked !== undefined
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isDark
                      ? 'text-emerald-400/85 hover:bg-slate-800 hover:text-emerald-300'
                      : 'text-emerald-600 hover:bg-slate-100'
                  }`}
                  title="切換待辦核取方塊"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                </button>

                {/* Node Detail Modal */}
                <button
                  type="button"
                  onClick={() => {
                    setColorPopoverOpen(false);
                    onOpenNodeDetail(selectedPositioned.node);
                  }}
                  className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    selectedHasMeta
                      ? 'bg-amber-500/20 text-amber-400'
                      : isDark
                      ? 'text-amber-400/85 hover:bg-slate-800 hover:text-amber-300'
                      : 'text-amber-600 hover:bg-slate-100'
                  }`}
                  title="編輯節點詳細資訊（備註、連結、標籤）"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {selectedHasMeta && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                </button>

                {/* Focus Branch */}
                <button
                  type="button"
                  onClick={() => {
                    setColorPopoverOpen(false);
                    handleFocusNode(selectedPositioned.node);
                  }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    focusedNodeId === selectedPositioned.node.id
                      ? 'bg-indigo-500/25 text-indigo-300'
                      : isDark
                      ? 'text-indigo-400 hover:bg-slate-800 hover:text-indigo-300'
                      : 'text-indigo-600 hover:bg-slate-100'
                  }`}
                  title="聚焦放大此分支"
                >
                  <Focus className="w-3.5 h-3.5" />
                </button>

                {/* Delete Node & Subtree */}
                {selectedPositioned.node.depth > 0 && (
                  <>
                    <div
                      className={`w-px h-4 mx-0.5 ${
                        isDark ? 'bg-slate-700/70' : 'bg-slate-200'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setColorPopoverOpen(false);
                        onDeleteNode(selectedPositioned.node);
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                      title="刪除此節點與子樹 (Delete)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                {/* iPad Markup Style Floating Color Swatch Popover */}
                {colorPopoverOpen && (
                  <div
                    data-mind-node="toolbar"
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute left-2 top-full mt-2 px-3 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center gap-2 z-40 animate-fade-in ${
                      isDark
                        ? 'bg-slate-900/95 border-slate-700/90 text-slate-200'
                        : 'bg-white/96 border-slate-200 text-slate-700'
                    }`}
                  >
                    {COLOR_PALETTES.map((pal) => {
                      const isActiveColor = selectedPalette.key === pal.key;
                      return (
                        <button
                          key={pal.key}
                          type="button"
                          onClick={() => {
                            onUpdateNode(selectedPositioned.node, { color: pal.key });
                            setColorPopoverOpen(false);
                          }}
                          className="w-5 h-5 rounded-full flex items-center justify-center hover:scale-125 active:scale-95 transition-transform shadow-sm"
                          style={{
                            backgroundColor: pal.hex,
                            boxShadow: isActiveColor
                              ? `0 0 0 2px ${isDark ? '#0f172a' : '#ffffff'}, 0 0 0 4px ${pal.hex}`
                              : undefined
                          }}
                          title={`套用${pal.label}分支色彩`}
                        >
                          {isActiveColor && (
                            <Check className="w-3 h-3 text-white stroke-[3]" />
                          )}
                        </button>
                      );
                    })}
                    <div
                      className={`w-px h-4 mx-0.5 ${
                        isDark ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateNode(selectedPositioned.node, { color: 'auto' });
                        setColorPopoverOpen(false);
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors ${
                        isDark
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                      title="重設為自動分支配色"
                    >
                      自動
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Focused Mode Banner */}
      {focusedNodeId && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-full shadow-lg text-xs animate-fade-in">
          <Focus className="w-3.5 h-3.5" />
          <span className="font-semibold">已聚焦放大節點</span>
          <button
            type="button"
            onClick={() => fitToView(true)}
            className="px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 font-bold text-[11px]"
          >
            返回全景
          </button>
        </div>
      )}

      {/* World Transform Container */}
      <div
        className={`absolute top-0 left-0 origin-top-left ${
          smoothAnim ? 'transition-transform duration-300 ease-out' : ''
        }`}
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`
        }}
      >
        {/* 1. SVG Cubic Bézier Edges */}
        <svg className="overflow-visible pointer-events-none absolute top-0 left-0" width={1} height={1}>
          {layout.edges.map((edge) => {
            const targetItem = layout.nodes.find((n) => edge.id.endsWith(`_${n.node.id}`));
            const stroke = targetItem
              ? resolveNodePalette(targetItem.node).hex
              : '#6366f1';

            return (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                stroke={stroke}
                strokeWidth={edge.depth === 1 ? 2.6 : 1.9}
                strokeOpacity={isDark ? 0.76 : 0.85}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* 2. HTML Interactive Node Cards */}
        {layout.nodes.map((item) => {
          const { node, x, y, width, height, isExpanded } = item;
          const isRoot = node.depth === 0;
          const hasChildren = node.children.length > 0;
          const palette = resolveNodePalette(node);

          const isSelected = selectedNodeId === node.id;
          const isCursorSynced = node.lineIndex === activeLineIndex && node.lineIndex >= 0;
          const isInlineEditing =
            inlineEditLineIndex !== null && inlineEditLineIndex === node.lineIndex;
          const isSearchHit =
            searchQuery.trim().length > 0 &&
            (node.text.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
              node.tags.some((t) =>
                t.toLowerCase().includes(searchQuery.trim().toLowerCase())
              ));

          const curDrop = dropTarget?.nodeId === node.id ? dropTarget.pos : null;
          const growLeft = node.direction === 'left' && !isRoot;
          const growDown = layoutMode === 'top-down';

          return (
            <div
              key={node.id}
              data-mind-node="card"
              draggable={!isRoot && !isInlineEditing && node.lineIndex >= 0}
              onDragStart={(e) => {
                e.stopPropagation();
                setDraggingNode(node);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (!draggingNode || draggingNode.id === node.id) return;
                e.preventDefault();
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const relY = (e.clientY - rect.top) / rect.height;
                let pos: 'before' | 'inside' | 'after' = 'inside';
                if (!isRoot) {
                  if (relY < 0.28) pos = 'before';
                  else if (relY > 0.72) pos = 'after';
                }
                setDropTarget({ nodeId: node.id, pos });
              }}
              onDragLeave={() => {
                if (dropTarget?.nodeId === node.id) setDropTarget(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggingNode && dropTarget) {
                  onReparentOrReorder(draggingNode, node, dropTarget.pos);
                }
                setDraggingNode(null);
                setDropTarget(null);
              }}
              onDragEnd={() => {
                setDraggingNode(null);
                setDropTarget(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setColorPopoverOpen(false);
                onSelectNode(node);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setColorPopoverOpen(false);
                setInlineDraft(node.text);
                onStartInlineEdit(node.lineIndex);
              }}
              style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${width}px`,
                minHeight: `${height}px`
              }}
              className={`absolute rounded-xl border transition-all duration-150 group/card cursor-pointer shadow-md flex flex-col justify-center ${
                isRoot
                  ? 'bg-gradient-to-br from-indigo-950 via-slate-900 to-cyan-950 border-cyan-400/70 text-white px-4 py-2.5 shadow-cyan-500/15'
                  : isDark
                  ? `${palette.darkBg} ${palette.darkBorder} text-slate-100 px-3.5 py-2`
                  : `${palette.lightBg} ${palette.lightBorder} text-slate-800 px-3.5 py-2 shadow-sm`
              } ${
                isSelected
                  ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/20 z-20'
                  : isCursorSynced
                  ? 'ring-1 ring-indigo-400/60'
                  : ''
              } ${
                isSearchHit ? 'ring-2 ring-amber-400 !bg-amber-950/80 !text-amber-100' : ''
              } ${
                curDrop === 'inside'
                  ? 'ring-2 ring-emerald-400 scale-[1.03]'
                  : curDrop === 'before'
                  ? 'border-t-4 !border-t-cyan-400'
                  : curDrop === 'after'
                  ? 'border-b-4 !border-b-cyan-400'
                  : ''
              }`}
            >
              {/* Colored Accent Bar */}
              {!isRoot && (
                <div
                  className={`absolute ${
                    growLeft ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'
                  } top-2 bottom-2 w-1 ${palette.accentBg}`}
                />
              )}

              {/* Drop Position Hint Pill */}
              {curDrop && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold whitespace-nowrap shadow">
                  {curDrop === 'inside'
                    ? '放開設為子節點'
                    : curDrop === 'before'
                    ? '放開插入至上方'
                    : '放開插入至下方'}
                </div>
              )}

              {/* Main Row: Checkbox + Inline Input or Text */}
              <div className="flex items-start gap-1.5">
                {node.checked !== undefined && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateNode(node, { checked: !node.checked });
                    }}
                    className="mt-0.5 text-emerald-400 hover:scale-110 transition-transform flex-shrink-0"
                    title="點擊切換完成狀態"
                  >
                    {node.checked ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                )}

                {isInlineEditing ? (
                  <input
                    ref={inlineInputRef}
                    type="text"
                    value={inlineDraft}
                    placeholder="輸入節點內容..."
                    onChange={(e) => setInlineDraft(e.target.value)}
                    onBlur={() => finishInlineEdit(node, 'commit')}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.nativeEvent.isComposing || e.keyCode === 229) {
                        return;
                      }
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        finishInlineEdit(node, 'commit');
                      } else if (e.key === 'Tab' && !e.shiftKey) {
                        e.preventDefault();
                        finishInlineEdit(node, 'addChild');
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        finishInlineEdit(node, 'cancel');
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full rounded px-1.5 py-0.5 text-xs font-semibold focus:outline-none ring-2 ring-cyan-400 ${
                      isDark
                        ? 'bg-slate-950 text-white placeholder-slate-500'
                        : 'bg-slate-100 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                ) : (
                  <div
                    className={`leading-snug break-words flex-1 ${
                      isRoot
                        ? 'text-sm font-extrabold tracking-wide'
                        : node.depth === 1
                        ? 'text-xs font-bold'
                        : 'text-xs font-medium'
                    } ${node.checked ? 'line-through opacity-60' : ''}`}
                  >
                    {node.text || '\u00A0'}
                  </div>
                )}
              </div>

              {/* Tags & External Link Row */}
              {(node.tags.length > 0 || node.url) && (
                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                  {node.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${palette.tagClass}`}
                    >
                      #{tag}
                    </span>
                  ))}
                  {node.url && (
                    <a
                      href={node.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30"
                      title={node.url}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      <span>連結</span>
                    </a>
                  )}
                </div>
              )}

              {/* Note Row */}
              {node.note && (
                <div
                  className={`mt-1 text-[10px] leading-tight line-clamp-2 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {node.note}
                </div>
              )}

              {/* Quick "+" Add Child Hover Button on Card Edge */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild(node);
                }}
                className={`opacity-0 group-hover/card:opacity-100 absolute z-20 w-5 h-5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow flex items-center justify-center transition-all ${
                  growDown
                    ? 'left-1/2 -translate-x-1/2 -bottom-2.5'
                    : growLeft
                    ? '-left-2.5 top-1/2 -translate-y-1/2'
                    : '-right-2.5 top-1/2 -translate-y-1/2'
                } ${hasChildren ? (growDown ? '!-bottom-8' : growLeft ? '!-left-9' : '!-right-9') : ''}`}
                title="點擊新增子節點"
              >
                <Plus className="w-3 h-3" />
              </button>

              {/* Expand / Collapse Badge (> / N) */}
              {hasChildren && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(node.id);
                  }}
                  className={`absolute z-20 flex items-center justify-center rounded-full border shadow transition-all active:scale-90 ${
                    growDown
                      ? 'left-1/2 -translate-x-1/2 -bottom-3'
                      : growLeft
                      ? '-left-3.5 top-1/2 -translate-y-1/2'
                      : '-right-3.5 top-1/2 -translate-y-1/2'
                  } ${
                    isExpanded
                      ? isDark
                        ? 'w-5 h-5 bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
                        : 'w-5 h-5 bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                      : 'px-1.5 h-5 text-[10px] font-bold bg-indigo-600 text-white border-indigo-400'
                  }`}
                  title={isExpanded ? '收合子分支' : `展開 ${node.children.length} 個子節點`}
                >
                  {isExpanded ? (
                    growDown ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : growLeft ? (
                      <ChevronRight className="w-3 h-3" />
                    ) : (
                      <ChevronLeft className="w-3 h-3" />
                    )
                  ) : (
                    <span className="flex items-center gap-0.5">
                      <span>{node.children.length}</span>
                      {growDown ? (
                        <ChevronDown className="w-2.5 h-2.5" />
                      ) : growLeft ? (
                        <ChevronLeft className="w-2.5 h-2.5" />
                      ) : (
                        <ChevronRight className="w-2.5 h-2.5" />
                      )}
                    </span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Floating Controls */}
      <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        <div
          className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] backdrop-blur-md pointer-events-auto ${
            isDark
              ? 'bg-slate-900/85 border-slate-800 text-slate-400'
              : 'bg-white/90 border-slate-200 text-slate-600'
          }`}
        >
          <span>💡 單擊節點開啟左上工具筆盒 · 雙擊直接打字 · Tab / Enter 新增節點自動置中 · 拖曳改階層</span>
        </div>

        <div
          className={`flex items-center gap-1 p-1 rounded-xl border shadow-lg backdrop-blur-md pointer-events-auto ml-auto ${
            isDark
              ? 'bg-slate-900/90 border-slate-700 text-slate-200'
              : 'bg-white/95 border-slate-200 text-slate-700'
          }`}
        >
          <button
            type="button"
            onClick={() => handleZoomStep(0.85)}
            className="p-1.5 rounded-lg hover:bg-slate-800/40"
            title="縮小"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerSmoothAnim(240);
              setZoom(1);
            }}
            className="px-2 py-1 rounded-lg text-[11px] font-mono min-w-[46px] text-center hover:bg-slate-800/40"
            title="重設 100% 比例"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => handleZoomStep(1.18)}
            className="p-1.5 rounded-lg hover:bg-slate-800/40"
            title="放大"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-700/40 mx-0.5" />
          <button
            type="button"
            onClick={() => fitToView(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-cyan-500 hover:bg-cyan-500/15"
            title="適應視窗置中 (或按滑鼠中鍵)"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden md:inline">置中適應</span>
          </button>
        </div>
      </div>
    </div>
  );
};

