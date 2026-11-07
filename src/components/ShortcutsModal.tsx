import React from 'react';
import { ThemeMode } from '../types/mindmap';
import { X, Keyboard, MousePointerClick, Code2 } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  theme: ThemeMode;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  theme,
  onClose
}) => {
  if (!isOpen) return null;
  const isDark = theme === 'dark';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl p-6 max-h-[85vh] overflow-y-auto ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between border-b pb-3 mb-4 border-slate-700/40">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold">Typemindmap 鍵盤快捷鍵與大綱語法指南</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Right Outliner Shortcuts */}
          <div className="space-y-2.5">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5 text-sm">
              <Keyboard className="w-4 h-4" />
              <span>右側大綱打字區快捷鍵</span>
            </div>
            {[
              ['Enter', '新增同層級節點（自動對齊縮排）'],
              ['Tab', '向內縮排一層（轉為子節點）'],
              ['Shift + Tab', '向外凸排一層（提升父層級）'],
              ['Alt + ↑ / ↓', '整塊上下移動節點與其所有子樹'],
              ['Ctrl + Z / Y', '復原 (Undo) / 重做 (Redo)']
            ].map(([k, desc]) => (
              <div key={k} className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/50">
                <kbd className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px] border border-slate-700">
                  {k}
                </kbd>
                <span className="text-slate-400 text-right">{desc}</span>
              </div>
            ))}
          </div>

          {/* Left MindMap Graphic Operations */}
          <div className="space-y-2.5">
            <div className="font-bold text-indigo-400 flex items-center gap-1.5 text-sm">
              <MousePointerClick className="w-4 h-4" />
              <span>左側心智圖直接互動操作</span>
            </div>
            {[
              ['單擊節點', '選取並顯示快速換色、新增、聚焦工具列'],
              ['雙擊節點 / F2', '直接在圖形卡片上打字修改內容'],
              ['Tab（選取節點時）', '直接在圖形上長出子節點並開始打字'],
              ['Enter（選取節點時）', '在圖形下方新增同級節點並開始打字'],
              ['Delete（選取節點時）', '刪除選取節點及其所有子分支'],
              ['按住拖曳節點', '拖至其他節點以改變父子階層或上下順序']
            ].map(([k, desc]) => (
              <div key={k} className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/50">
                <kbd className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[11px] border border-slate-700 whitespace-nowrap">
                  {k}
                </kbd>
                <span className="text-slate-400 text-right">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Inline Syntax */}
        <div className="mt-5 pt-4 border-t border-slate-700/40 text-xs space-y-2">
          <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-sm">
            <Code2 className="w-4 h-4" />
            <span>行內智慧增強語法（打字即渲染，圖形修改亦自動寫回）</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <code className="text-emerald-300 font-mono">[ ] 任務</code> 或 <code className="text-emerald-300 font-mono">[x] 任務</code>
              <div className="mt-0.5 text-[11px]">產生可直接在圖形點擊打勾的待辦方塊</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <code className="text-cyan-300 font-mono">#重點 #Q4</code>
              <div className="mt-0.5 text-[11px]">為節點加上醒目的彩色標籤徽章</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <code className="text-amber-300 font-mono">// 補充說明文字</code>
              <div className="mt-0.5 text-[11px]">在節點卡片下方顯示精簡備註小字</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <code className="text-purple-300 font-mono">@color(emerald)</code> / <code className="text-blue-300 font-mono">https://...</code>
              <div className="mt-0.5 text-[11px]">指定分支顏色或附加可點擊外部連結</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
