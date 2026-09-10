import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, Loader2, MessageSquare, AlertCircle } from 'lucide-react';
import SourceAccordion from './SourceAccordion';

export default function ChatPanel({
  activeDocument,
  messages,
  onSendMessage,
  isLoading,
  chatError,
  onOpenSidebar
}) {
  const [question, setQuestion] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || isLoading || !activeDocument) return;
    onSendMessage(question.trim());
    setQuestion('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  let hostname = activeDocument?.url;
  try {
    if (activeDocument?.url) hostname = new URL(activeDocument.url).hostname.replace(/^www\./, '');
  } catch {
    // keep raw url as fallback
  }

  return (
    <div className="flex-1 min-w-0 bg-zinc-950 flex flex-col h-full overflow-hidden">
      {/* Header showing active source */}
      <div className="h-14 px-5 border-b border-zinc-800 flex items-center shrink-0">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100 truncate">
            {activeDocument ? (activeDocument.title || hostname) : 'Select a source to start chatting'}
          </h2>
          {activeDocument && <p className="text-xs text-zinc-500 truncate">{hostname}</p>}
        </div>
      </div>

      {/* Chat Transcript Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {!activeDocument ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-medium text-zinc-300">No source selected</h3>
            <p className="text-sm text-zinc-500 max-w-xs mt-1.5 leading-relaxed">
              Add a link to a webpage, then come back here to ask questions about it.
            </p>
            <button
              type="button"
              onClick={onOpenSidebar}
              className="md:hidden mt-4 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
            >
              Add a source
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-12 h-12 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-medium text-zinc-200">
              Ask anything about this page
            </h3>
            <p className="text-sm text-zinc-500 max-w-xs mt-1.5 leading-relaxed">
              I'll answer using only what's on the page, and show you where the answer came from.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={index}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${
                    isUser ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Message Bubble */}
                <div className={`flex flex-col min-w-0 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-sm'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <SourceAccordion sources={msg.sources} />
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex gap-3 max-w-3xl mr-auto">
            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-zinc-900 border border-zinc-800 flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Thinking…</span>
            </div>
          </div>
        )}

        {/* Chat Error Alert */}
        {chatError && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/50 text-rose-300 text-sm flex items-center gap-2.5 max-w-3xl">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{chatError}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Chat Input */}
      <div className="p-4 border-t border-zinc-800 shrink-0">
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
          <textarea
            rows={1}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!activeDocument || isLoading}
            placeholder={activeDocument ? 'Ask a question…' : 'Select a source first'}
            className="w-full pl-4 pr-12 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 resize-none transition disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!question.trim() || isLoading || !activeDocument}
            className="absolute right-2 bottom-2 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
