import React, { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

export default function DocumentItem({ doc, isActive, onSelect, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(doc._id, doc.url);
    } finally {
      setIsDeleting(false);
    }
  };

  let hostname = doc.url;
  try {
    hostname = new URL(doc.url).hostname.replace(/^www\./, '');
  } catch {
    // keep raw url as fallback
  }

  const formattedDate = doc.createdAt
    ? new Date(doc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      onClick={() => onSelect(doc)}
      className={`group relative px-3.5 py-3 rounded-lg border cursor-pointer transition ${
        isActive
          ? 'bg-indigo-950/30 border-indigo-600/50'
          : 'bg-zinc-900/40 border-zinc-800/70 hover:bg-zinc-900 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-zinc-100 truncate pr-2">
            {doc.title || hostname}
          </h4>
          <p className="text-xs text-zinc-500 truncate mt-0.5">{hostname}</p>
        </div>

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          title="Remove source"
          className="p-1.5 rounded-md text-zinc-600 hover:text-rose-400 hover:bg-rose-950/30 transition shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      <p className="text-xs text-zinc-600 mt-2">
        {doc.chunkCount} {doc.chunkCount === 1 ? 'chunk' : 'chunks'}
        {formattedDate ? ` · ${formattedDate}` : ''}
      </p>

      {isActive && <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-indigo-500" />}
    </div>
  );
}
