import React, { useState, useEffect } from 'react';
import { LanguageMode, NodeColorKey, OutlineNode, ThemeMode } from '../types/mindmap';
import { I18N } from '../utils/i18n';
import { COLOR_PALETTES } from '../utils/layoutEngine';
import { ParsedLineAttrs } from '../utils/outlineEngine';
import { X, Check, Link2, Tag, StickyNote, Palette, CheckSquare } from 'lucide-react';

interface NodeDetailModalProps {
  node: OutlineNode | null;
  theme: ThemeMode;
  language: LanguageMode;
  onClose: () => void;
  onSave: (node: OutlineNode, patch: Partial<ParsedLineAttrs>) => void;
}

export const NodeDetailModal: React.FC<NodeDetailModalProps> = ({
  node,
  theme,
  language,
  onClose,
  onSave
}) => {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [color, setColor] = useState<NodeColorKey>('auto');
  const [checkMode, setCheckMode] = useState<'none' | 'unchecked' | 'checked'>('none');

  useEffect(() => {
    if (node) {
      setText(node.text);
      setNote(node.note || '');
      setUrl(node.url || '');
      setTagsInput(node.tags.join(', '));
      setColor(node.color || 'auto');
      setCheckMode(
        node.checked === true ? 'checked' : node.checked === false ? 'unchecked' : 'none'
      );
    }
  }, [node]);

  if (!node) return null;

  const isDark = theme === 'dark';
  const t = I18N[language];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTags = tagsInput
      .split(/[,，\s]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean);

    onSave(node, {
      text: text.trim() || '未命名節點',
      note: note.trim() || undefined,
      url: url.trim() || undefined,
      tags: cleanTags,
      color: color === 'auto' ? undefined : color,
      checked:
        checkMode === 'checked' ? true : checkMode === 'unchecked' ? false : undefined
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4 ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between border-b pb-3 border-slate-700/40">
          <h3 className="text-sm font-bold">{t.detailModalTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-400">{t.nodeTextLabel}</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 ${
              isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          />
        </div>

        {/* Note */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-1 text-slate-400">
            <StickyNote className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.noteLabel}</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.notePlaceholder}
            className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 ${
              isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          />
        </div>

        {/* URL & Tags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold mb-1 text-slate-400">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.tagsLabel}</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t.tagsPlaceholder}
              className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 ${
                isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold mb-1 text-slate-400">
              <Link2 className="w-3.5 h-3.5 text-blue-400" />
              <span>{t.urlLabel}</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className={`w-full rounded-xl border px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 ${
                isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>

        {/* Checkbox status */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-1.5 text-slate-400">
            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.checkStatusLabel}</span>
          </label>
          <div className="flex items-center gap-2 text-xs">
            {[
              { id: 'none', label: t.checkNone },
              { id: 'unchecked', label: t.checkUnchecked },
              { id: 'checked', label: t.checkChecked }
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCheckMode(opt.id as any)}
                className={`px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                  checkMode === opt.id
                    ? 'bg-cyan-600 text-white border-cyan-500'
                    : isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-400'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold mb-1.5 text-slate-400">
            <Palette className="w-3.5 h-3.5 text-purple-400" />
            <span>{t.nodeColorLabel}</span>
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setColor('auto')}
              className={`px-2.5 py-1 rounded-lg text-xs border ${
                color === 'auto'
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold'
                  : 'border-slate-700 text-slate-400'
              }`}
            >
              {t.autoColor}
            </button>
            {COLOR_PALETTES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setColor(p.key)}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${
                  color === p.key ? 'scale-125 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: p.hex }}
                title={p.label}
              >
                {color === p.key && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/40">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
          >
            {t.btnCancel}
          </button>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t.btnSave}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

