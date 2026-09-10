# URL-CHAT

RAG-powered chat over any webpage. Paste a URL, and ask questions answered strictly
from that page's content, with the source passages shown under every answer.

**Stack:** React + Vite, Express, LangChain.js, Google Gemini, MongoDB Atlas Vector Search.

## Local development

```bash
npm run install:all          # installs server + client
# create server/.env (see "Environment variables")
npm run dev                  # server on :5000, client on :5173
```

Vite proxies `/api` to the local server, so no client env var is needed for local dev.

## Environment variables

### Backend (`server/.env` locally, Render dashboard in production)

| Variable | Required | Notes |
| --- | --- | --- |
| `GOOGLE_API_KEY` | yes | Server exits on startup without it. |
| `MONGO_URI` | yes in production | Atlas connection string. Without it, data is in-memory only. |
| `CLIENT_URL` | yes in production | Frontend origin for CORS, e.g. `https://url-chat.vercel.app`. Comma-separate to allow more than one. |
| `NODE_ENV` | yes in production | Set to `production`. |
| `GOOGLE_CHAT_MODEL` | no | Defaults to `models/gemini-3.6-flash`. |
| `GOOGLE_EMBEDDING_MODEL` | no | Defaults to `models/gemini-embedding-001`. |


## Deployment

Backend runs on Render, frontend on Vercel.

### 1. MongoDB Atlas (one-time)

```bash
node server/scripts/setupVectorIndex.js
```

Creates the `vector_index` search index that retrieval depends on. Then, in Atlas

```
