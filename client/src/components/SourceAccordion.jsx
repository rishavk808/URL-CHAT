import React, { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';

export default function SourceAccordion({ sources }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2.5 w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-1 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
        <span>{sources.length} {sources.length === 1 ? 'source' : 'sources'}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto pr-1">
          {sources.map((source, index) => (
            <div key={index} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs space-y-1">
              {source.metadata?.url && (
                <span className="block text-zinc-500 truncate">
                  {source.metadata.title || source.metadata.url}
                </span>
              )}
              <p className="text-zinc-400 leading-relaxed line-clamp-4">
                {source.pageContent}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
