import React, { useState } from 'react';
import { LayoutMode, ThemeMode } from '../types/mindmap';
import { MINDMAP_TEMPLATES, MindMapTemplate } from '../utils/templates';
import {
  Network,
  Undo2,
  Redo2,
  Download,
  Upload,
  Sun,
  Moon,
  Keyboard,
  PanelRightClose,
  PanelRightOpen,
  BookTemplate,
  Layers,
  AlignLeft,
  AlignRight,
  GitFork,
  ChevronDown,
  Image as ImageIcon,
  FileCode2,
  FileText,
  FileJson
} from 'lucide-react';

interface TopToolbarProps {
  theme: ThemeMode;
  layoutMode: LayoutMode;
  expandPreset: number | 'all';
  canUndo: boolean;
  canRedo: boolean;
  isRightPanelOpen: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onChangeLayout: (mode: LayoutMode) => void;
  onChangeExpandPreset: (preset: number | 'all') => void;
  onSelectTemplate: (tpl: MindMapTemplate) => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportMarkdown: () => void;
  onExportMermaid: () => void;
  onExportTxt: () => void;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
  onToggleRightPanel: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  theme,
  layoutMode,
  expandPreset,
  canUndo,
  canRedo,
  isRightPanelOpen,
  onUndo,
  onRedo,
  onChangeLayout,
  onChangeExpandPreset,
  onSelectTemplate,
  onExportPng,
  onExportSvg,
  onExportMarkdown,
  onExportMermaid,
  onExportTxt,
  onExportJson,
  onImportJson,
  onToggleTheme,
  onOpenShortcuts,
  onToggleRightPanel
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const isDark = theme === 'dark';

  const layoutOptions: { id: LayoutMode; label: string; icon: React.ReactNode }[] = [
    { id: 'right', label: '右側邏輯', icon: <AlignLeft className="w-3.5 h-3.5" /> },
    { id: 'balanced', label: '雙向平衡', icon: <GitFork className="w-3.5 h-3.5 rotate-90" /> },
    { id: 'left', label: '左側邏輯', icon: <AlignRight className="w-3.5 h-3.5" /> },
    { id: 'top-down', label: '垂直樹狀', icon: <Network className="w-3.5 h-3.5" /> }
  ];

  return (
    <header
      className={`w-full h-12 px-3 md:px-4 border-b flex items-center justify-between gap-2 select-none z-40 transition-colors ${
        isDark
          ? 'bg-slate-900/95 border-slate-800 text-slate-100'
          : 'bg-white/95 border-slate-200 text-slate-800'
      }`}
    >
      {/* Left: Brand & Undo/Redo */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
            <Network className="w-4 h-4" />
          </div>
          <div className="leading-tight">
            <span className="font-extrabold text-sm tracking-wide">Typemindmap</span>
            <span
              className={`hidden lg:inline-block ml-2 text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                isDark
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60'
                  : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
              }`}
            >
              左圖右文 · 雙向同步
            </span>
          </div>
        </div>

        <div className={`h-4 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
            title="復原 (Ctrl + Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
            }`}
            title="重做 (Ctrl + Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center: Layout Switcher & Expand Level */}
      <div className="hidden md:flex items-center gap-2">
        {/* Layout Switcher */}
        <div
          className={`flex items-center p-0.5 rounded-xl border text-xs ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          {layoutOptions.map((opt) => {
            const active = layoutMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeLayout(opt.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all ${
                  active
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`切換為${opt.label}佈局`}
              >
                {opt.icon}
                <span className="hidden xl:inline">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Expand Depth Preset */}
        <div
          className={`flex items-center gap-0.5 p-0.5 rounded-xl border text-xs ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <span className="px-1.5 text-[11px] text-slate-400 hidden lg:inline-flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-500" />
            展開
          </span>
          {([1, 2, 3, 'all'] as const).map((lv) => {
            const active = expandPreset === lv;
            return (
              <button
                key={String(lv)}
                type="button"
                onClick={() => onChangeExpandPreset(lv)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lv === 'all' ? '全展開' : `${lv}層`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Templates, Export, Shortcuts, Theme, Toggle Outliner */}
      <div className="flex items-center gap-1.5">
        {/* Templates Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowTemplates((v) => !v);
              setShowExport(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
              isDark
                ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-200'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
          >
            <BookTemplate className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">範本</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {showTemplates && (
            <div
              className={`absolute right-0 top-full mt-2 w-72 rounded-2xl border shadow-2xl p-2 z-50 animate-fade-in ${
                isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
              onMouseLeave={() => setShowTemplates(false)}
            >
              <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400">
                快速套用精選範本（將建立新分頁）
              </div>
              <div className="space-y-1">
                {MINDMAP_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      onSelectTemplate(tpl);
                      setShowTemplates(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-colors ${
                      isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold">{tpl.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      {tpl.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowExport((v) => !v);
              setShowTemplates(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">匯出</span>
            <ChevronDown className="w-3 h-3 opacity-80" />
          </button>

          {showExport && (
            <div
              className={`absolute right-0 top-full mt-2 w-56 rounded-2xl border shadow-2xl py-1.5 z-50 text-xs animate-fade-in ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
              }`}
              onMouseLeave={() => setShowExport(false)}
            >
              <button
                type="button"
                onClick={() => {
                  onExportPng();
                  setShowExport(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 transition-colors ${
                  isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span>匯出 PNG 高清圖片 (2x)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onExportSvg();
                  setShowExport(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 transition-colors ${
                  isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                <span>匯出 SVG 向量圖檔</span>
              </button>

              <div className={`h-px my-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

              <button
                type="button"
                onClick={() => {
                  onExportMarkdown();
                  setShowExport(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 transition-colors ${
                  isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>匯出 Markdown (.md)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onExportMermaid();
                  setShowExport(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 transition-colors ${
                  isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <FileCode2 className="w-4 h-4 text-purple-400" />
                <span>匯出 Mermaid 語法 (.mmd)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onExportTxt();
                  setShowExport(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 transition-colors ${
                  isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>匯出純文字大綱 (.txt)</span>
              </button>

              <div className={`h-px my-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

              <button
                type="button"
                onClick={() => {
                  onExportJson();
                  setShowExport(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 transition-colors ${
                  isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <FileJson className="w-4 h-4 text-blue-400" />
                <span>備份整個工作區 (.json)</span>
              </button>

              <label
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 cursor-pointer transition-colors ${
                  isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <Upload className="w-4 h-4 text-rose-400" />
                <span>還原工作區備份 (.json)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    onImportJson(e);
                    setShowExport(false);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Shortcuts Button */}
        <button
          type="button"
          onClick={onOpenShortcuts}
          className={`p-2 rounded-xl border transition-colors ${
            isDark
              ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-300'
              : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
          }`}
          title="鍵盤快捷鍵與語法指南"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Theme Switch */}
        <button
          type="button"
          onClick={onToggleTheme}
          className={`p-2 rounded-xl border transition-colors ${
            isDark
              ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-amber-300'
              : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-indigo-600'
          }`}
          title={isDark ? '切換為淺色主題' : '切換為深色主題'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Toggle Right Outliner */}
        <button
          type="button"
          onClick={onToggleRightPanel}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
            isRightPanelOpen
              ? isDark
                ? 'bg-indigo-600/25 border-indigo-500/50 text-indigo-300'
                : 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : isDark
              ? 'bg-slate-800 border-slate-700 text-slate-300'
              : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}
          title={isRightPanelOpen ? '隱藏右側大綱編輯器 (全螢幕心智圖)' : '展開右側大綱編輯器'}
        >
          {isRightPanelOpen ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
          <span className="hidden lg:inline">{isRightPanelOpen ? '收合打字區' : '開啟打字區'}</span>
        </button>
      </div>
    </header>
  );
};
