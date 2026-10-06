import React from 'react';
import { Globe, Menu, LogOut } from 'lucide-react';

export default function Header({ activeDocumentCount, onToggleSidebar, user, onLogout }) {
  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950 px-3 sm:px-5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="md:hidden p-1.5 -ml-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition"
          aria-label="Toggle sources panel"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <Globe className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-[15px] text-zinc-100 tracking-tight">URL Chat</span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {activeDocumentCount > 0 && (
          <span className="hidden sm:inline text-xs text-zinc-500">
            {activeDocumentCount} {activeDocumentCount === 1 ? 'source' : 'sources'} saved
          </span>
        )}
        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline text-xs text-zinc-500 truncate max-w-[160px]">{user.email}</span>
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
