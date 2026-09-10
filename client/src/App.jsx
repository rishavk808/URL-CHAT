import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import IngestionPanel from './components/IngestionPanel';
import ChatPanel from './components/ChatPanel';
import {
  getDocuments,
  ingestUrl,
  sendChatMessage,
  deleteDocument,
  getChatHistory
} from './services/api';

const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_DEFAULT_WIDTH = 380;
const SIDEBAR_WIDTH_STORAGE_KEY = 'urlchat:sidebarWidth';

const clampSidebarWidth = (width) => {
  // Keep the chat panel from being squeezed to nothing on narrower windows
  const upperBound = Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth - 360);
  return Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), Math.max(upperBound, SIDEBAR_MIN_WIDTH));
};

const readStoredSidebarWidth = () => {
  try {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    return stored ? stored : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
};

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [activeDocument, setActiveDocument] = useState(null);
  const [messages, setMessages] = useState([]);

  const [isIngesting, setIsIngesting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [ingestError, setIngestError] = useState(null);

  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState(() =>
    typeof window === 'undefined' ? SIDEBAR_DEFAULT_WIDTH : clampSidebarWidth(readStoredSidebarWidth())
  );
  const [isResizing, setIsResizing] = useState(false);

  // Drag-to-resize the sidebar (desktop only — mobile uses the slide-in drawer instead)
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      setSidebarWidth(clampSidebarWidth(clientX));
    };
    const stopResizing = () => setIsResizing(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stopResizing);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', stopResizing);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', stopResizing);
    };
  }, [isResizing]);

  // Persist the chosen width, and re-clamp it if the window is resized narrower
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
    } catch {
      // localStorage unavailable (e.g. private browsing) — width just won't persist
    }
  }, [sidebarWidth]);

  useEffect(() => {
    const handleWindowResize = () => setSidebarWidth((w) => clampSidebarWidth(w));
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // Load documents on initial load
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Fetch chat history whenever active document changes
  useEffect(() => {
    if (activeDocument?.url) {
      fetchChatHistory(activeDocument.url);
    } else {
      setMessages([]);
    }
  }, [activeDocument]);

  const fetchDocuments = async () => {
    try {
      const data = await getDocuments();
      if (data.success) {
        setDocuments(data.documents);
        // Automatically select first document if none active
        if (data.documents.length > 0 && !activeDocument) {
          setActiveDocument(data.documents[0]);
        }
      }
    } catch (err) {
      console.error('Error loading documents:', err);
    }
  };

  const fetchChatHistory = async (url) => {
    try {
      const data = await getChatHistory(url);
      if (data.success) {
        setMessages(data.history || []);
      }
    } catch (err) {
      console.error('Error loading chat history:', err);
    }
  };

  // Handle URL Ingestion with 4-Step Pipeline simulation
  const handleIngestUrl = async (targetUrl) => {
    setIsIngesting(true);
    setIngestError(null);
    setCurrentStep(1); // Step 1: Webpage Content Scraped

    // Stepper progression timer helper
    const stepTimer1 = setTimeout(() => setCurrentStep(2), 1200); // Step 2: Chunked & Cleaned
    const stepTimer2 = setTimeout(() => setCurrentStep(3), 2800); // Step 3: Embeddings Generated

    try {
      const result = await ingestUrl(targetUrl);

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      setCurrentStep(4); // Step 4: Vectors Indexed

      // Short pause to show completed 4th step before resetting stepper
      setTimeout(async () => {
        setCurrentStep(0);
        setIsIngesting(false);

        await fetchDocuments();

        // Set new document as active
        const newDoc = {
          _id: result.documentId,
          url: result.url,
          title: result.title,
          chunkCount: result.chunkCount,
          createdAt: result.createdAt
        };
        setActiveDocument(newDoc);
        setIsSidebarOpen(false);
      }, 1000);

    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsIngesting(false);
      setCurrentStep(0);
      setIngestError(err.response?.data?.error || err.message || 'Failed to ingest URL.');
    }
  };

  // Handle Sending Chat Message
  const handleSendMessage = async (question) => {
    if (!activeDocument) return;

    setChatError(null);
    const userMsg = { role: 'user', content: question, sources: [] };
    setMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const data = await sendChatMessage(activeDocument.url, question);
      const botMsg = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources || []
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setChatError(err.response?.data?.error || err.message || 'Error generating answer.');
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSelectDocument = (doc) => {
    setActiveDocument(doc);
    setIsSidebarOpen(false);
  };

  // Handle Document Deletion
  const handleDeleteDocument = async (id, docUrl) => {
    try {
      await deleteDocument(id);
      const updatedDocs = documents.filter((doc) => doc._id !== id);
      setDocuments(updatedDocs);

      if (activeDocument?.url === docUrl) {
        setActiveDocument(updatedDocs.length > 0 ? updatedDocs[0] : null);
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  return (
    <div
      className={`h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden font-sans antialiased ${
        isResizing ? 'select-none cursor-col-resize' : ''
      }`}
    >
      {/* Header */}
      <Header
        activeDocumentCount={documents.length}
        onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
      />

      {/* Main Split Screen Desktop Body */}
      <main className="flex-1 flex flex-row overflow-hidden relative">
        {/* Left Panel: Ingestion & Library (fixed drawer on mobile, resizable sidebar on desktop) */}
        <IngestionPanel
          documents={documents}
          activeDocument={activeDocument}
          onSelectDocument={handleSelectDocument}
          onIngestUrl={handleIngestUrl}
          onDeleteDocument={handleDeleteDocument}
          isIngesting={isIngesting}
          currentStep={currentStep}
          error={ingestError}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          width={sidebarWidth}
        />

        {/* Drag handle to resize the sidebar (desktop only) */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sources panel"
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          className="hidden md:flex relative w-1.5 shrink-0 cursor-col-resize items-center justify-center group z-10 -mx-0.5"
        >
          <div
            className={`w-px h-full transition-colors ${
              isResizing ? 'bg-indigo-500' : 'bg-zinc-800 group-hover:bg-indigo-500/60'
            }`}
          />
        </div>

        {/* Right Panel: Chat Interface */}
        <ChatPanel
          activeDocument={activeDocument}
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isChatLoading}
          chatError={chatError}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
      </main>
    </div>
  );
}
