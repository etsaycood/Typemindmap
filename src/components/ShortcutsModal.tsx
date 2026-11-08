import React from 'react';
import { ThemeMode, LanguageMode } from '../types/mindmap';
import { X, Keyboard, MousePointerClick, Code2 } from 'lucide-react';
import { I18N } from '../utils/i18n';

interface ShortcutsModalProps {
  isOpen: boolean;
  theme: ThemeMode;
  language: LanguageMode;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  theme,
  language,
  onClose
}) => {
  if (!isOpen) return null;
  const isDark = theme === 'dark';
  const t = I18N[language];

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
            <h2 className="text-base font-bold">{t.shortcutsModalTitle}</h2>
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
              <span>{t.shortcutsOutlinerHeading}</span>
            </div>
            {[
              ['Enter', t.scEnterOutliner],
              ['Tab', t.scTabOutliner],
              ['Shift + Tab', t.scShiftTabOutliner],
              ['Alt + ↑ / ↓', t.scAltArrows],
              ['Ctrl + Z / Y', t.scUndoRedo]
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
              <span>{t.shortcutsMindMapHeading}</span>
            </div>
            {[
              [language === 'zh' ? '單擊節點' : 'Click Node', t.scClickNode],
              [language === 'zh' ? '雙擊節點 / F2' : 'Double Click / F2', t.scDblClickNode],
              [language === 'zh' ? 'Tab（選取節點時）' : 'Tab (Selected)', t.scTabCanvas],
              [language === 'zh' ? 'Enter（選取節點時）' : 'Enter (Selected)', t.scEnterCanvas],
              [language === 'zh' ? 'Delete（選取節點時）' : 'Delete (Selected)', t.scDeleteCanvas],
              [language === 'zh' ? '按住拖曳節點' : 'Drag Node', t.scDragCanvas]
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
            <span>{t.shortcutsSyntaxHeading}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <code className="text-emerald-300 font-mono">[ ] 任務</code> / <code className="text-emerald-300 font-mono">[x] 任務</code>
              <div className="mt-0.5 text-[11px]">{t.syntaxTodoDesc}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <code className="text-cyan-300 font-mono">#重點 #Q4</code>
              <div className="mt-0.5 text-[11px]">{t.syntaxTagDesc}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <code className="text-amber-300 font-mono">// 補充說明文字</code>
              <div className="mt-0.5 text-[11px]">{t.syntaxNoteDesc}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <code className="text-purple-300 font-mono">@color(emerald)</code> / <code className="text-blue-300 font-mono">https://...</code>
              <div className="mt-0.5 text-[11px]">{t.syntaxColorLinkDesc}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

