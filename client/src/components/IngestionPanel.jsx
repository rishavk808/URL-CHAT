import React, { useState, useEffect } from 'react';
import { Plus, Globe, Loader2, X } from 'lucide-react';
import StatusStepper from './StatusStepper';
import DocumentItem from './DocumentItem';

const DEMO_URLS = [
  { label: 'React (Wikipedia)', url: 'https://en.wikipedia.org/wiki/React_(software)' },
  { label: 'LangChain.js Docs', url: 'https://js.langchain.com/docs/introduction/' },
  { label: 'JavaScript (MDN)', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' }
];

// Matches Tailwind's `md` breakpoint — below it the sidebar is a slide-in drawer
// (proportional width), at/above it the sidebar is a static, user-resizable column.
const DESKTOP_QUERY = '(min-width: 768px)';

export default function IngestionPanel({
  documents,
  activeDocument,
  onSelectDocument,
  onIngestUrl,
  onDeleteDocument,
  isIngesting,
  currentStep,
  error,
  isOpen,
  onClose,
  width
}) {
  const [inputUrl, setInputUrl] = useState('');
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const handleChange = (e) => setIsDesktop(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputUrl.trim() || isIngesting) return;
    onIngestUrl(inputUrl.trim());
    setInputUrl('');
  };

  return (
    <>
      {/* Backdrop (mobile only, shown while the drawer is open) */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          aria-hidden="true"
        />
      )}

      <div
        style={isDesktop ? { width } : undefined}
        className={`fixed inset-y-0 left-0 z-40 w-[86%] max-w-[380px] md:max-w-none border-r border-zinc-800 md:border-r-0 bg-zinc-950 md:bg-zinc-900/30 flex flex-col h-full shrink-0 transform transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:static md:translate-x-0 md:z-auto`}
      >
      <div className="p-5 space-y-4 border-b border-zinc-800/60">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Add a source</h2>
            <p className="text-sm text-zinc-500 mt-0.5 leading-relaxed">
              Paste a link and I'll read the page so you can ask questions about it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition shrink-0"
            aria-label="Close sources panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="relative">
            <Globe className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://example.com/article"
              disabled={isIngesting}
              className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={!inputUrl.trim() || isIngesting}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
          >
            {isIngesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reading page…
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add source
              </>
            )}
          </button>
        </form>

        {!isIngesting && documents.length === 0 && (
          <div className="pt-1">
            <span className="text-xs text-zinc-500 block mb-1.5">Or try an example</span>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_URLS.map((demo, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputUrl(demo.url)}
                  className="px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 transition"
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && !isIngesting && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/50 text-rose-300 text-sm leading-relaxed">
            {error}
          </div>
        )}

        <StatusStepper currentStep={currentStep} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {documents.length > 0 && (
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-2.5 bg-zinc-950 md:bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800/60">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Your sources</h3>
            <span className="text-xs text-zinc-600">{documents.length}</span>
          </div>
        )}

        {documents.length === 0 ? (
          <div className="mt-4 py-10 text-center px-5">
            <Globe className="w-6 h-6 text-zinc-700 mx-auto mb-2.5" />
            <p className="text-sm text-zinc-500">No sources yet</p>
            <p className="text-xs text-zinc-600 mt-1">Add a link above to get started</p>
          </div>
        ) : (
          <div className="space-y-2 p-5 pt-3">
            {documents.map((doc) => (
              <DocumentItem
                key={doc._id}
                doc={doc}
                isActive={activeDocument?.url === doc.url}
                onSelect={onSelectDocument}
                onDelete={onDeleteDocument}
              />
            ))}
          </div>
        )}
      </div>
      </div>
    </>
  );
}
