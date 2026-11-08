import React, { useState, useEffect, useMemo } from 'react';
import { ThemeMode, LanguageMode, DocumentTab } from '../types/mindmap';
import {
  CloudProvider,
  CLOUD_PROVIDERS,
  ShareMode,
  SharedMindMapPayload,
  ShareUploadResult,
  uploadSharePayload,
  formatByteSize,
  TYPEMINDMAP_CANONICAL_URL
} from '../utils/cloudShare';
import { I18N } from '../utils/i18n';
import {
  Share2,
  X,
  Copy,
  Check,
  ExternalLink,
  FileJson,
  Globe,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Layers,
  Sparkles
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  theme: ThemeMode;
  language: LanguageMode;
  tabs: DocumentTab[];
  activeTab: DocumentTab;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  theme,
  language,
  tabs,
  activeTab,
  onClose
}) => {
  const [shareMode, setShareMode] = useState<ShareMode>('current_tab');
  const [preferredProvider, setPreferredProvider] = useState<CloudProvider | 'auto'>('auto');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ShareUploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'share' | 'gh' | 'raw' | 'web' | null>(null);

  const isDark = theme === 'dark';
  const t = I18N[language];

  // Reset states on open
  useEffect(() => {
    if (isOpen) {
      setShareMode('current_tab');
      setPreferredProvider('auto');
      setUploadResult(null);
      setErrorMsg(null);
      setCopiedType(null);
      setIsUploading(false);
    }
  }, [isOpen, activeTab.id]);

  // Clear result when options change
  useEffect(() => {
    setUploadResult(null);
    setErrorMsg(null);
  }, [shareMode, preferredProvider]);

  // Count lines / nodes in active tab
  const activeTabLinesCount = useMemo(() => {
    return activeTab.content.split('\n').filter((l) => l.trim().length > 0).length;
  }, [activeTab.content]);

  // Count total lines / nodes across all tabs
  const totalWorkspaceLinesCount = useMemo(() => {
    return tabs.reduce((acc, tab) => {
      return acc + tab.content.split('\n').filter((l) => l.trim().length > 0).length;
    }, 0);
  }, [tabs]);

  // Construct payload
  const payload = useMemo<SharedMindMapPayload>(() => {
    const createdAt = new Date().toISOString();
    if (shareMode === 'current_tab') {
      return {
        app: 'Typemindmap',
        version: '1.0.0',
        shareMode: 'current_tab',
        title: activeTab.title,
        createdAt,
        tab: {
          id: activeTab.id,
          title: activeTab.title,
          content: activeTab.content,
          layoutMode: activeTab.layoutMode
        }
      };
    }
    return {
      app: 'Typemindmap',
      version: '1.0.0',
      shareMode: 'workspace',
      title: activeTab.title,
      createdAt,
      tabs,
      activeTabId: activeTab.id,
      theme
    };
  }, [shareMode, activeTab, tabs, theme]);

  const estimatedBytes = useMemo(() => {
    try {
      return new Blob([JSON.stringify(payload)]).size;
    } catch {
      return 0;
    }
  }, [payload]);

  if (!isOpen) return null;

  const handleGenerateLink = async () => {
    setErrorMsg(null);
    setIsUploading(true);
    try {
      const res = await uploadSharePayload(payload, preferredProvider);
      setUploadResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || (language === 'zh' ? '產生分享連結失敗，請稍後再試' : 'Failed to generate share link'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopy = (text: string, type: 'share' | 'gh' | 'raw' | 'web') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '::1');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isDark ? 'bg-slate-900 border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b ${
            isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">{t.shareModalTitle}</h3>
              <p className="text-[11px] text-slate-400">
                {language === 'zh'
                  ? '免註冊·免資料庫·跨裝置開啟即用'
                  : 'Zero Sign-up · No Database · Instant Cross-Device'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Share Mode Switch */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">
              {language === 'zh' ? '分享範圍' : 'Share Scope'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShareMode('current_tab')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  shareMode === 'current_tab'
                    ? isDark
                      ? 'border-cyan-500 bg-cyan-950/30 text-cyan-200 ring-1 ring-cyan-500/50'
                      : 'border-cyan-600 bg-cyan-50 text-cyan-900 ring-1 ring-cyan-600/30'
                    : isDark
                    ? 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t.shareModeCurrent}</span>
                </div>
                <div className="text-[11px] opacity-75 line-clamp-1">{activeTab.title}</div>
                <div className="text-[10px] mt-1 text-cyan-400/80 font-mono">
                  {t.shareSingleTabSummary(activeTabLinesCount)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShareMode('workspace')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  shareMode === 'workspace'
                    ? isDark
                      ? 'border-indigo-500 bg-indigo-950/30 text-indigo-200 ring-1 ring-indigo-500/50'
                      : 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-600/30'
                    : isDark
                    ? 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t.shareModeWorkspace}</span>
                </div>
                <div className="text-[11px] opacity-75 line-clamp-1">
                  {tabs.map((t) => t.title).join(', ')}
                </div>
                <div className="text-[10px] mt-1 text-indigo-400/80 font-mono">
                  {t.shareWorkspaceSummary(tabs.length, totalWorkspaceLinesCount)}
                </div>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 pt-0.5">
              {shareMode === 'current_tab' ? t.shareModeCurrentDesc : t.shareModeWorkspaceDesc}
            </p>
          </div>

          {/* Cloud Provider Select & Size Indicator */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-400">{t.shareProviderLabel}</label>
              <span className="font-mono text-[11px] text-cyan-400">
                {t.shareSizeEstimate(formatByteSize(estimatedBytes))}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setPreferredProvider('auto')}
                className={`px-2.5 py-2 rounded-xl border text-xs font-medium text-left transition-all flex flex-col justify-center ${
                  preferredProvider === 'auto'
                    ? isDark
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300'
                      : 'border-cyan-600 bg-cyan-50 text-cyan-900'
                    : isDark
                    ? 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  {language === 'zh' ? '自動' : 'Auto'}
                </span>
                <span className="text-[10px] opacity-70">
                  {language === 'zh' ? '推薦最佳' : 'Best'}
                </span>
              </button>

              {(['p', 'd', 'j'] as const).map((prov) => {
                const meta = CLOUD_PROVIDERS[prov];
                const active = preferredProvider === prov;
                return (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => setPreferredProvider(prov)}
                    className={`px-2.5 py-2 rounded-xl border text-xs font-medium text-left transition-all flex flex-col justify-center ${
                      active
                        ? isDark
                          ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300'
                          : 'border-indigo-600 bg-indigo-50 text-indigo-900'
                        : isDark
                        ? 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold">{meta.name}</span>
                    <span className="text-[10px] opacity-70 truncate">{meta.maxSizeDesc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Button: Generate */}
          {!uploadResult && (
            <button
              type="button"
              disabled={isUploading}
              onClick={handleGenerateLink}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-lg shadow-cyan-600/25 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.shareBtnGenerating}</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>{t.shareBtnGenerate}</span>
                </>
              )}
            </button>
          )}

          {/* Upload Result Section */}
          {uploadResult && (
            <div
              className={`p-4 rounded-2xl border space-y-3 animate-fade-in ${
                isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.shareSuccessTitle}</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {uploadResult.providerName} · {formatByteSize(uploadResult.byteSize)}
                </span>
              </div>

              {/* Main Share Link Box */}
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-400">
                  {t.shareLinkBoxLabel}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={uploadResult.shareUrl}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-mono border select-all outline-none ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-cyan-300 focus:border-cyan-500'
                        : 'bg-white border-slate-300 text-cyan-800 focus:border-cyan-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(uploadResult.shareUrl, 'share')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                      copiedType === 'share'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white active:scale-95'
                    }`}
                  >
                    {copiedType === 'share' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t.shareCopied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t.shareCopy}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* If on localhost, provide GitHub Pages canonical share link */}
              {isLocalhost && (
                <div className="space-y-1 pt-1">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                    <span>{t.shareCanonicalHint}</span>
                    <span className="text-[10px] text-amber-400">
                      {language === 'zh' ? '適合發送給外網朋友' : 'For external sharing'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={uploadResult.githubPagesUrl}
                      className={`flex-1 px-3 py-1.5 rounded-xl text-[11px] font-mono border select-all outline-none ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-indigo-300'
                          : 'bg-white border-slate-300 text-indigo-800'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(uploadResult.githubPagesUrl, 'gh')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                        copiedType === 'gh'
                          ? 'bg-emerald-600 text-white'
                          : isDark
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                      }`}
                    >
                      {copiedType === 'gh' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{t.shareCopied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t.shareCopy}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Action Links */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                <a
                  href={uploadResult.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-cyan-300'
                      : 'border-slate-300 bg-white hover:bg-slate-100 text-cyan-700'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t.shareOpenNewTab}</span>
                </a>

                <a
                  href={uploadResult.rawUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300'
                      : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <FileJson className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t.shareViewRaw}</span>
                </a>

                <a
                  href={uploadResult.webViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300'
                      : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.shareViewWeb}</span>
                </a>
              </div>
            </div>
          )}

          {/* Bottom Friendly Explanatory Note */}
          <div
            className={`p-3 rounded-xl border text-[11px] leading-relaxed ${
              isDark ? 'bg-slate-950/40 border-slate-800/70 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            💡 {t.shareExplanation}
          </div>
        </div>
      </div>
    </div>
  );
};

