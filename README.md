# URL-CHAT

RAG-powered chat over any webpage. Paste a URL, and ask questions that are answered
**strictly from that page's content** — with the exact source passages shown under every answer.

**Stack:** React + Vite + Tailwind · Express (ESM) · LangChain.js · Google Gemini (embeddings + chat) · MongoDB Atlas Vector Search

---

## Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [How the RAG pipeline works](#how-the-rag-pipeline-works)
- [Project layout](#project-layout)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Design decisions & fallbacks](#design-decisions--fallbacks)

---

## What it does

1. **Ingest** – you give it a URL. The server scrapes the page, strips the noise
   (nav, scripts, footers, SVGs…), splits the readable text into overlapping chunks,
   embeds each chunk with Gemini, and stores the vectors in MongoDB Atlas.
2. **Chat** – you ask a question. The server embeds the question, runs a vector
   similarity search scoped to that URL, feeds the top matching chunks to Gemini as
   context, and returns an answer that is grounded only in those chunks.
3. **Cite** – every assistant answer ships with the chunks it was built from, shown in
   a collapsible "sources" panel so you can verify the answer against the page.
4. **Persist** – indexed pages and full chat history are saved per-URL, so you can
   close the tab and pick a source back up later.

---

## Architecture

```mermaid
flowchart LR
    subgraph Client["Client — React + Vite (Vercel)"]
        UI["IngestionPanel + ChatPanel"]
        API["services/api.js (axios)"]
        UI --> API
    end

    subgraph Server["Server — Express (Render)"]
        R["routes/ragRoutes.js"]
        C["controllers/ragController.js"]
        S["services/ragService.js"]
        R --> C --> S
    end

    subgraph External["External services"]
        G["Google Gemini<br/>embeddings + chat"]
        M[("MongoDB Atlas<br/>documents · chatmessages<br/>chunks + vector_index")]
        W["Target webpage"]
    end

    API -- "POST /api/ingest<br/>POST /api/chat<br/>GET /api/documents<br/>GET /api/chat/history<br/>DELETE /api/documents/:id" --> R
    S -- "scrape (axios + cheerio)" --> W
    S -- "embed / generate" --> G
    S -- "vector search + read/write" --> M
```

### Client

- **React 18 + Vite 6**, styled with **Tailwind CSS 3** (dark theme, single-page app).
- Two-pane layout: a resizable **IngestionPanel** (add URL, source library, ingest
  progress stepper) and a **ChatPanel** (markdown-rendered transcript with per-message
  source accordions). Collapses to a slide-in drawer on mobile.
- `react-markdown` + `remark-gfm` render assistant answers; `lucide-react` for icons.
- All network calls go through [`client/src/services/api.js`](client/src/services/api.js).
  In dev, requests hit `/api` and Vite proxies them to `http://localhost:5000`; in prod
  set `VITE_API_URL` to the backend origin.

### Server

- **Express** app ([`server/src/index.js`](server/src/index.js)) with `helmet`,
  `compression`, configurable **CORS** (`CLIENT_URL` accepts a comma-separated list),
  a **rate limiter** (30 req/min on `/api`), request logging, a `/health` endpoint,
  and graceful shutdown on `SIGINT`/`SIGTERM`.
- Thin **routes → controller → service** structure. All RAG logic lives in
  [`server/src/services/ragService.js`](server/src/services/ragService.js); the
  controller only validates input and shapes responses.
- Can optionally serve the built client from `client/dist` in production for a
  single-port deployment (`npm start` from the repo root).

### Storage

| Collection      | Written by            | Purpose                                                        |
| --------------- | --------------------- | ------------------------------------------------------------- |
| `documents`     | Mongoose `Document`   | One record per indexed URL (title, chunk count, timestamp).   |
| `chatmessages`  | Mongoose `ChatMessage`| Full per-URL conversation history, incl. stored source chunks.|
| `chunks`        | LangChain `MongoDBAtlasVectorSearch` | Text chunk + 3072-dim embedding + `{ url, title, chunkIndex }` metadata. Queried through the `vector_index` Atlas Vector Search index. |

If `MONGO_URI` is not set (or Atlas is unreachable at boot), the server runs in
**in-memory mode**: a LangChain `MemoryVectorStore` plus plain `Map`s hold documents,
chunks, and chat history for the lifetime of the process.

---

## How the RAG pipeline works

### Ingestion — `POST /api/ingest`

`processAndIndexUrl(url)` in [`ragService.js`](server/src/services/ragService.js):

1. **Scrape** (`scrapeAndCleanUrl`) – `axios` fetches the HTML with a browser
   User-Agent (15 s timeout). `cheerio` removes `script, style, nav, footer, header,
   aside, iframe, noscript, svg, form`, then extracts text from `<main>`, else
   `<article>`, else `<body>`. Title comes from `<title>` → `<h1>` → `og:title` → the URL.
   Whitespace is collapsed; pages with < 50 chars of text are rejected.
2. **Chunk** – `RecursiveCharacterTextSplitter` with `chunkSize: 1000`,
   `chunkOverlap: 200`. Each chunk carries `{ url, title, chunkIndex, totalChunks }`.
3. **Embed** – `GoogleGenerativeAIEmbeddings` (`models/gemini-embedding-001`, 3072 dims).
4. **Index** – old chunks for the same URL are deleted first (re-ingest is idempotent),
   then `store.addDocuments(docs)` writes chunk + vector into the `chunks` collection.
5. **Record** – upsert a `Document` metadata row (or an in-memory entry).

The client shows a 4-step progress stepper during this call.

### Query — `POST /api/chat`

`queryRagChain(url, question)`:

1. **Retrieve** – `store.similaritySearch(question, 15)`, then filter results down to
   `metadata.url === url` and keep the top **4** chunks. (Over-fetching then filtering
   keeps retrieval scoped to the active page even though all pages share one index.)
2. **Fallback retrieval** – if vector search errors or returns nothing, a keyword
   overlap scorer (`performTextRelevanceSearch`) ranks the in-memory chunks for that URL.
3. **Assemble context** – chunks are concatenated as `[Source Chunk N]\n…` blocks.
4. **Generate** – `ChatGoogleGenerativeAI` (`models/gemini-3.6-flash`, `temperature: 0.2`)
   with a strict system prompt: answer only from context, and if the context is
   insufficient reply exactly *"I could not find relevant information in the provided URL."*
5. **Respond & persist** – returns `{ answer, sources }` and appends the user question
   and assistant answer (with its source chunks) to chat history.

---

## Project layout

```
URL-CHAT/
├── package.json              # root scripts: install:all, dev, build, start (uses concurrently)
├── client/
│   ├── vite.config.js        # dev server on :5173, proxies /api → :5000
│   └── src/
│       ├── App.jsx           # state: documents, activeDocument, messages, ingest steps
│       ├── services/api.js   # axios client for all 5 endpoints
│       └── components/       # Header, IngestionPanel, ChatPanel, StatusStepper,
│                             # DocumentItem, SourceAccordion
└── server/
    ├── scripts/
    │   └── setupVectorIndex.js   # one-time: create `chunks` collection + `vector_index`
    └── src/
        ├── index.js              # Express app, middleware, static hosting, lifecycle
        ├── config/db.js          # Mongo connect w/ SRV-DNS fallback; degrades to in-memory
        ├── routes/ragRoutes.js
        ├── controllers/ragController.js
        ├── services/ragService.js   # scrape · chunk · embed · index · retrieve · generate
        └── models/
            ├── Document.js
            └── ChatMessage.js
```

---

## API reference

Base path: `/api`

| Method & path              | Body / query                | Returns |
| -------------------------- | --------------------------- | ------- |
| `POST /api/ingest`         | `{ url }`                   | `{ success, documentId, url, title, chunkCount, createdAt }` |
| `POST /api/chat`           | `{ url, question }`         | `{ answer, sources: [{ pageContent, metadata }] }` |
| `GET /api/chat/history`    | `?url=<url>`                | `{ success, history: ChatMessage[] }` |
| `GET /api/documents`       | –                          | `{ success, documents: Document[] }` (newest first) |
| `DELETE /api/documents/:id`| path param `id`            | `{ success, message, deletedId }` — also drops the URL's chunks and chat history |
| `GET /health`              | –                          | `{ status, environment, timestamp, service }` |

`POST /api/ingest` normalizes bare hosts (`example.com` → `https://example.com`) and
rejects malformed URLs with `400`.

---

## Data model

**Document**
| Field        | Type   | Notes                        |
| ------------ | ------ | ---------------------------- |
| `url`        | String | unique, required             |
| `title`     | String | scraped page title           |
| `chunkCount` | Number | chunks produced at ingest    |
| `createdAt`  | Date   | defaults to now              |

**ChatMessage**
| Field       | Type                        | Notes                                   |
| ----------- | --------------------------- | --------------------------------------- |
| `url`       | String (indexed)            | which source this message belongs to    |
| `role`      | `'user' \| 'assistant' \| 'system'` | required                        |
| `content`   | String                      | required                                |
| `sources`   | `[{ pageContent, metadata }]` | retrieved chunks (assistant messages) |
| `createdAt` | Date                        | ordering key for history                |

---

## Local development

```bash
npm run install:all          # installs both server/ and client/
# create server/.env  (see "Environment variables")
npm run dev                  # server on :5000, client on :5173, run concurrently
```

Vite proxies `/api` to the local server, so no client env var is needed for local dev.
`MONGO_URI` is optional locally — without it the app runs fully in memory.

Other root scripts:

| Script                         | Effect                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| `npm run build`                | builds the client into `client/dist`                        |
| `npm start`                    | builds the client, then runs the server in production mode serving that build (single port) |
| `npm run start:server-only`    | production server without rebuilding the client            |

---

## Environment variables

### Backend — `server/.env` locally, host dashboard in production

| Variable                 | Required            | Notes |
| ------------------------ | ------------------ | ----- |
| `GOOGLE_API_KEY`         | **yes**            | Server exits on startup without it. |
| `MONGO_URI`              | yes in production  | Atlas connection string. Without it, data is in-memory only. |
| `CLIENT_URL`             | yes in production  | Frontend origin(s) for CORS, e.g. `https://url-chat.vercel.app`. Comma-separate to allow several. |
| `NODE_ENV`               | yes in production  | Set to `production`. |
| `PORT`                   | no                 | Defaults to `5000`. |
| `GOOGLE_CHAT_MODEL`      | no                 | Defaults to `models/gemini-3.6-flash`. |
| `GOOGLE_EMBEDDING_MODEL` | no                 | Defaults to `models/gemini-embedding-001` (3072 dims — must match the Atlas index). |

### Frontend — `client/.env`

| Variable       | Required           | Notes |
| -------------- | ----------------- | ----- |
| `VITE_API_URL` | yes in production | Backend API base, e.g. `https://url-chat-api.onrender.com/api`. Omit locally (Vite proxy handles it). |

---
## Design decisions & fallbacks

- **Graceful degradation.** No Mongo? The server logs a warning and runs on an
  in-memory vector store instead of crashing — handy for demos and local dev.
- **Retrieval robustness.** If the embedding API or vector index fails at query time,
  a keyword-overlap search over the cached chunks still produces an answer.
- **Idempotent ingest.** Re-adding a URL deletes its previous chunks before indexing,
  so counts and vectors never drift.
- **Grounded answers.** The system prompt forbids outside knowledge and mandates a
  fixed "not found" response, and the UI surfaces the source chunks so answers are auditable.
- **SRV DNS retry.** `config/db.js` retries the Atlas `mongodb+srv://` lookup against
  public DNS (1.1.1.1 / 8.8.8.8) when the local resolver is misconfigured (common on VPNs).
- **Persistent embeddings.** Vectors live in Atlas, so restarts don't re-scrape or
  re-embed anything; on boot the server just logs how many docs and chunks it found.
