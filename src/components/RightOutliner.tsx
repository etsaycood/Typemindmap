import React, { useRef, useState, useEffect } from 'react';
import { DocumentTab, LanguageMode, OutlineNode, ThemeMode } from '../types/mindmap';
import { I18N } from '../utils/i18n';
import { moveSubtreeVertical } from '../utils/outlineEngine';
import {
  Plus,
  X,
  ArrowRightToLine,
  ArrowLeftToLine,
  Delete,
  CornerDownLeft,
  CheckSquare,
  Hash,
  StickyNote,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface RightOutlinerProps {
  tabs: DocumentTab[];
  activeTabId: string;
  content: string;
  rootNode: OutlineNode;
  activeLineIndex: number;
  theme: ThemeMode;
  language: LanguageMode;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onRenameTab: (tabId: string, newTitle: string) => void;
  onCloseTab: (tabId: string) => void;
  onChangeContent: (newContent: string, nextCursorLine?: number, triggerCenter?: boolean) => void;
  onActiveLineChange: (lineIdx: number) => void;
  externalJumpLine?: { lineIndex: number; seq: number } | null;
}

export const RightOutliner: React.FC<RightOutlinerProps> = ({
  tabs,
  activeTabId,
  content,
  rootNode,
  activeLineIndex,
  theme,
  language,
  onSelectTab,
  onAddTab,
  onRenameTab,
  onCloseTab,
  onChangeContent,
  onActiveLineChange,
  externalJumpLine
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const isDark = theme === 'dark';
  const t = I18N[language];
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  const LINE_HEIGHT = 24;
  const PADDING_TOP = 12;

  // Sync scroll between gutter and textarea
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Scroll active line so it sits comfortably in the upper portion (~30% from top)
  const scrollLineToUpperPortion = (lineIdx: number, smooth: boolean = true) => {
    const el = textareaRef.current;
    if (!el) return;

    const lineY = PADDING_TOP + lineIdx * LINE_HEIGHT;
    const clientH = el.clientHeight || 500;
    const targetOffset = Math.round(clientH * 0.30);
    const targetScrollTop = Math.max(0, lineY - targetOffset);

    if (Math.abs(el.scrollTop - targetScrollTop) > 6) {
      if (smooth) {
        el.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      } else {
        el.scrollTop = targetScrollTop;
      }
    }
  };

  // When typing, ensure line doesn't sink past the upper zone (~38% of visible height)
  const ensureLineInUpperPortion = (lineIdx: number) => {
    const el = textareaRef.current;
    if (!el) return;

    const lineY = PADDING_TOP + lineIdx * LINE_HEIGHT;
    const clientH = el.clientHeight || 500;
    const relativeY = lineY - el.scrollTop;

    // If the line sinks past 38% of visible height or is scrolled out above:
    if (relativeY > clientH * 0.38 || relativeY < 0) {
      const targetOffset = Math.round(clientH * 0.30);
      const targetScrollTop = Math.max(0, lineY - targetOffset);
      el.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    }
  };

  // Jump cursor to line when user selects/focuses a node on the MindMap canvas
  useEffect(() => {
    if (!externalJumpLine || !textareaRef.current) return;
    const targetLine = Math.max(0, Math.min(lines.length - 1, externalJumpLine.lineIndex));
    scrollLineToUpperPortion(targetLine, true);
  }, [externalJumpLine]); // eslint-disable-line react-hooks/exhaustive-deps

  const computeLineIndexFromPos = (text: string, pos: number): number => {
    const sub = text.slice(0, Math.max(0, pos));
    return sub.split('\n').length - 1;
  };

  const updateCursorLine = () => {
    const el = textareaRef.current;
    if (!el) return;
    const idx = computeLineIndexFromPos(el.value, el.selectionStart);
    onActiveLineChange(idx);
    ensureLineInUpperPortion(idx);
  };

  // Indent or outdent selected lines
  const adjustIndentation = (outdent: boolean) => {
    const el = textareaRef.current;
    if (!el) return;

    const val = el.value.replace(/\r\n/g, '\n');
    const selStart = el.selectionStart;
    const selEnd = el.selectionEnd;

    const allLines = val.split('\n');
    const startLine = computeLineIndexFromPos(val, selStart);
    const endLine = computeLineIndexFromPos(val, selEnd);

    let firstDelta = 0;
    let totalDelta = 0;

    for (let i = startLine; i <= endLine; i++) {
      const cur = allLines[i];
      if (!outdent) {
        allLines[i] = '  ' + cur;
        if (i === startLine) firstDelta = 2;
        totalDelta += 2;
      } else {
        if (cur.startsWith('  ')) {
          allLines[i] = cur.slice(2);
          if (i === startLine) firstDelta = -2;
          totalDelta -= 2;
        } else if (cur.startsWith('\t') || cur.startsWith(' ')) {
          allLines[i] = cur.slice(1);
          if (i === startLine) firstDelta = -1;
          totalDelta -= 1;
        }
      }
    }

    const nextText = allLines.join('\n');
    onChangeContent(nextText, startLine, true);

    window.requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        Math.max(0, selStart + firstDelta),
        Math.max(0, selEnd + totalDelta)
      );
      ensureLineInUpperPortion(startLine);
    });
  };

  // Backspace / Delete character or selection
  const handleBackspace = () => {
    const el = textareaRef.current;
    if (!el) return;

    const val = el.value.replace(/\r\n/g, '\n');
    const selStart = el.selectionStart;
    const selEnd = el.selectionEnd;

    let nextVal = val;
    let nextCursor = selStart;

    if (selStart !== selEnd) {
      // 1. If text is selected, delete the entire selection
      nextVal = val.slice(0, selStart) + val.slice(selEnd);
      nextCursor = selStart;
    } else if (selStart > 0) {
      // 2. No selection: check line start and indentation
      const lineStart = val.lastIndexOf('\n', selStart - 1) + 1;
      const curLineBeforeCursor = val.slice(lineStart, selStart);

      // If at an indent (2 spaces) before cursor, outdent/delete 2 spaces
      if (curLineBeforeCursor.endsWith('  ') && /^\s*$/.test(curLineBeforeCursor)) {
        nextVal = val.slice(0, selStart - 2) + val.slice(selStart);
        nextCursor = selStart - 2;
      } else if (curLineBeforeCursor.endsWith('\t')) {
        nextVal = val.slice(0, selStart - 1) + val.slice(selStart);
        nextCursor = selStart - 1;
      } else {
        // Otherwise delete 1 character or newline
        nextVal = val.slice(0, selStart - 1) + val.slice(selStart);
        nextCursor = selStart - 1;
      }
    } else {
      return;
    }

    const nextLineIdx = computeLineIndexFromPos(nextVal, nextCursor);
    onChangeContent(nextVal, nextLineIdx);
    onActiveLineChange(nextLineIdx);

    window.requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      ensureLineInUpperPortion(nextLineIdx);
    });
  };

  // Enter / 換行 button handler (auto-preserve indent & keep cursor line in upper portion)
  const handleEnter = () => {
    const el = textareaRef.current;
    if (!el) return;

    const val = el.value.replace(/\r\n/g, '\n');
    const selStart = el.selectionStart;
    const selEnd = el.selectionEnd;

    const lineStart = val.lastIndexOf('\n', selStart - 1) + 1;
    const curLineBeforeCursor = val.slice(lineStart, selStart);
    const indentMatch = curLineBeforeCursor.match(/^[ \t]*/);
    const indent = (indentMatch ? indentMatch[0] : '').replace(/\t/g, '  ');

    // If current line is line 0 (root) and has 0 indent, indent the second line by 2 spaces automatically!
    const curLineIdx = computeLineIndexFromPos(val, selStart);
    const nextIndent = curLineIdx === 0 && indent.length === 0 ? '  ' : indent;
    const nextLineIdx = curLineIdx + 1;

    const nextVal = val.slice(0, selStart) + '\n' + nextIndent + val.slice(selEnd);
    const nextCursor = selStart + 1 + nextIndent.length;

    onChangeContent(nextVal, nextLineIdx);
    onActiveLineChange(nextLineIdx);

    window.requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.selectionStart = nextCursor;
      textareaRef.current.selectionEnd = nextCursor;
      scrollLineToUpperPortion(nextLineIdx, true);
    });
  };

  // Move current line + subtree up/down
  const handleMoveBlock = (dir: 'up' | 'down') => {
    const res = moveSubtreeVertical(content, rootNode, activeLineIndex, dir);
    if (!res) return;
    onChangeContent(res.content, res.newLineIndex);
    onActiveLineChange(res.newLineIndex);

    window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const newLines = res.content.split('\n');
      let charOffset = 0;
      for (let i = 0; i < res.newLineIndex && i < newLines.length; i++) {
        charOffset += newLines[i].length + 1;
      }
      const lineLen = newLines[res.newLineIndex]?.length || 0;
      el.focus();
      el.setSelectionRange(charOffset + lineLen, charOffset + lineLen);
      scrollLineToUpperPortion(res.newLineIndex, true);
    });
  };

  // Quick insert snippet on current active line
  const handleQuickSyntax = (kind: 'checkbox' | 'tag' | 'note') => {
    const el = textareaRef.current;
    const curLines = content.replace(/\r\n/g, '\n').split('\n');
    const idx = Math.max(0, Math.min(curLines.length - 1, activeLineIndex));
    const raw = curLines[idx] || '';
    const indent = raw.match(/^\s*/)?.[0] || '';
    const body = raw.slice(indent.length);

    if (kind === 'checkbox') {
      if (/^\[ \]\s*/.test(body)) {
        curLines[idx] = `${indent}${body.replace(/^\[ \]\s*/, '[x] ')}`;
      } else if (/^\[[xX]\]\s*/.test(body)) {
        curLines[idx] = `${indent}${body.replace(/^\[[xX]\]\s*/, '')}`;
      } else {
        curLines[idx] = `${indent}[ ] ${body}`;
      }
    } else if (kind === 'tag') {
      curLines[idx] = `${raw.trimEnd()} #重點`;
    } else if (kind === 'note') {
      if (!raw.includes(' // ')) {
        curLines[idx] = `${raw.trimEnd()} // 備註說明`;
      }
    }

    const next = curLines.join('\n');
    onChangeContent(next, idx);
    window.requestAnimationFrame(() => {
      el?.focus();
      ensureLineInUpperPortion(idx);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. Tab / Shift+Tab -> Indent / Outdent
    if (e.key === 'Tab') {
      e.preventDefault();
      adjustIndentation(e.shiftKey);
      return;
    }

    // 2. Alt + ArrowUp / ArrowDown -> Move Subtree Block Up/Down
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      handleMoveBlock(e.key === 'ArrowUp' ? 'up' : 'down');
      return;
    }

    // 3. Enter -> Auto-preserve current line indentation & keep typing line in upper portion
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleEnter();
      return;
    }
  };

  const submitTabRename = (tabId: string) => {
    if (renameValue.trim()) {
      onRenameTab(tabId, renameValue.trim());
    }
    setRenamingTabId(null);
  };

  return (
    <aside
      className={`w-full h-full flex flex-col border-l select-none ${
        isDark
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : 'bg-white border-slate-200 text-slate-800'
      }`}
    >
      {/* 1. Multi-Document Tabs Header */}
      <div
        className={`flex items-center justify-between px-2 pt-2 border-b gap-1 overflow-x-auto ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-1 overflow-x-auto min-w-0 pb-1.5">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isRenaming = renamingTabId === tab.id;

            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                onDoubleClick={() => {
                  setRenamingTabId(tab.id);
                  setRenameValue(tab.title);
                }}
                className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-all flex-shrink-0 border ${
                  isActive
                    ? isDark
                      ? 'bg-slate-800 border-cyan-500/50 text-cyan-300 font-bold shadow-sm'
                      : 'bg-white border-cyan-500 text-cyan-700 font-bold shadow-sm'
                    : isDark
                    ? 'bg-slate-900/50 border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/60'
                }`}
                title={t.tabTooltip}
              >
                {isRenaming ? (
                  <input
                    type="text"
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => submitTabRename(tab.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitTabRename(tab.id);
                      if (e.key === 'Escape') setRenamingTabId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-24 bg-slate-950 text-white px-1.5 py-0.5 rounded border border-cyan-500 text-xs focus:outline-none"
                  />
                ) : (
                  <span className="truncate max-w-[120px]">{tab.title}</span>
                )}

                {tabs.length > 1 && !isRenaming && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-500/20 hover:text-rose-400 transition-opacity"
                    title={t.deleteTabTooltip}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={onAddTab}
            className={`p-1.5 rounded-xl transition-colors flex-shrink-0 ${
              isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-cyan-300'
                : 'hover:bg-slate-200 text-slate-600 hover:text-cyan-700'
            }`}
            title={t.addTabTooltip}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Quick Outliner Action Strip */}
      <div
        className={`flex items-center justify-between px-3 py-1.5 border-b text-[11px] ${
          isDark
            ? 'bg-slate-900/90 border-slate-800 text-slate-400'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}
      >
        {/* Left: Node Count */}
        <span className="font-mono text-[10px] opacity-75 select-none pl-0.5">
          {t.nodesCount(rootNode.totalDescendants + 1)}
        </span>

        {/* Right: Functional Action Buttons */}
        <div className="flex items-center gap-1 ml-auto">
          {/* Toggle Checkbox */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleQuickSyntax('checkbox')}
            className={`p-1.5 rounded-lg active:scale-90 transition-all ${
              isDark ? 'hover:bg-slate-800 hover:text-emerald-300' : 'hover:bg-slate-200 hover:text-emerald-700'
            }`}
            title="切換待辦方塊 [ ] / [x]"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>

          {/* Insert Tag */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleQuickSyntax('tag')}
            className={`p-1.5 rounded-lg active:scale-90 transition-all ${
              isDark ? 'hover:bg-slate-800 hover:text-cyan-300' : 'hover:bg-slate-200 hover:text-cyan-700'
            }`}
            title="插入 #標籤"
          >
            <Hash className="w-3.5 h-3.5" />
          </button>

          {/* Insert Note */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleQuickSyntax('note')}
            className={`p-1.5 rounded-lg active:scale-90 transition-all ${
              isDark ? 'hover:bg-slate-800 hover:text-amber-300' : 'hover:bg-slate-200 hover:text-amber-700'
            }`}
            title="插入 // 備註說明"
          >
            <StickyNote className="w-3.5 h-3.5" />
          </button>

          <div className={`h-3.5 w-px mx-1 ${isDark ? 'bg-slate-800' : 'bg-slate-300'}`} />

          {/* Move Subtree Up */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleMoveBlock('up')}
            className={`p-1.5 rounded-lg active:scale-90 transition-all ${
              isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-200 hover:text-slate-900'
            }`}
            title={t.moveUpTooltip}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          {/* Move Subtree Down */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleMoveBlock('down')}
            className={`p-1.5 rounded-lg active:scale-90 transition-all ${
              isDark ? 'hover:bg-slate-800 hover:text-white' : 'hover:bg-slate-200 hover:text-slate-900'
            }`}
            title={t.moveDownTooltip}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <div className={`h-3.5 w-px mx-1 ${isDark ? 'bg-slate-800' : 'bg-slate-300'}`} />

          {/* >| Tab (Indent) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => adjustIndentation(false)}
            className={`p-1.5 rounded-lg active:scale-90 transition-all ${
              isDark ? 'hover:bg-slate-800 hover:text-cyan-300' : 'hover:bg-slate-200 hover:text-cyan-700'
            }`}
            title={t.indentTooltip}
          >
            <ArrowRightToLine className="w-3.5 h-3.5" />
          </button>

          {/* |< Shift+Tab (Outdent) */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => adjustIndentation(true)}
            className={`p-1.5 rounded-lg active:scale-90 transition-all ${
              isDark ? 'hover:bg-slate-800 hover:text-cyan-300' : 'hover:bg-slate-200 hover:text-cyan-700'
            }`}
            title={t.outdentTooltip}
          >
            <ArrowLeftToLine className="w-3.5 h-3.5" />
          </button>

          {/* < Backspace / Delete */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleBackspace}
            className={`p-1.5 rounded-lg active:scale-90 transition-all ${
              isDark ? 'hover:bg-slate-800 hover:text-rose-400' : 'hover:bg-slate-200 hover:text-rose-600'
            }`}
            title={t.backspaceTooltip}
          >
            <Delete className="w-3.5 h-3.5" />
          </button>

          {/* ↵ Enter / 換行 */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleEnter}
            className={`p-1.5 rounded-lg active:scale-90 transition-all ${
              isDark ? 'hover:bg-slate-800 hover:text-emerald-400' : 'hover:bg-slate-200 hover:text-emerald-600'
            }`}
            title={t.enterTooltip}
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Main Outliner Code Editor with Line Gutter */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden font-mono text-[13px]">
        {/* Line Numbers Gutter */}
        <div
          ref={gutterRef}
          className={`w-10 py-3 overflow-hidden text-right pr-2.5 select-none border-r ${
            isDark
              ? 'bg-slate-950/50 border-slate-800/80 text-slate-600'
              : 'bg-slate-50 border-slate-200 text-slate-400'
          }`}
          style={{ paddingBottom: '50vh' }}
        >
          {lines.map((_, idx) => {
            const isCurrent = idx === activeLineIndex;
            return (
              <div
                key={idx}
                className={`h-6 leading-6 text-[11px] transition-colors ${
                  isCurrent
                    ? isDark
                      ? 'text-cyan-400 font-bold'
                      : 'text-cyan-600 font-bold'
                    : ''
                }`}
              >
                {idx + 1}
              </div>
            );
          })}
        </div>

        {/* Indented Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            const val = e.target.value;
            const lineIdx = computeLineIndexFromPos(val, e.target.selectionStart);
            onChangeContent(val, lineIdx);
            onActiveLineChange(lineIdx);
            ensureLineInUpperPortion(lineIdx);
          }}
          onClick={updateCursorLine}
          onKeyUp={updateCursorLine}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          wrap="off"
          placeholder={t.editorPlaceholder}
          className={`flex-1 h-full py-3 px-3.5 leading-6 resize-none focus:outline-none overflow-auto select-text ${
            isDark
              ? 'bg-slate-950/30 text-slate-100 placeholder-slate-600'
              : 'bg-white text-slate-800 placeholder-slate-400'
          }`}
          style={{
            paddingBottom: '50vh',
            backgroundImage: isDark
              ? 'repeating-linear-gradient(to right, transparent 0, transparent 15px, rgba(148,163,184,0.08) 15px, rgba(148,163,184,0.08) 16px)'
              : 'repeating-linear-gradient(to right, transparent 0, transparent 15px, rgba(100,116,139,0.12) 15px, rgba(100,116,139,0.12) 16px)',
            backgroundAttachment: 'local',
            backgroundPositionX: '14px'
          }}
        />
      </div>

      {/* 4. Bottom Status Hint */}
      <div
        className={`px-3 py-1.5 border-t flex items-center justify-between text-[11px] ${
          isDark
            ? 'bg-slate-950 border-slate-800 text-slate-500'
            : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}
      >
        <span>{t.footerShortcuts}</span>
        <span className="text-emerald-500/90 font-medium">{t.autoSaved}</span>
      </div>
    </aside>
  );
};

