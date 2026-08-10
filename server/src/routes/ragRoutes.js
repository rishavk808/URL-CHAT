import express from 'express';

const router = express.Router();

// Ingest webpage URL endpoint
router.post('/ingest', ingestUrl);

// Chat with indexed URL endpoint
router.post('/chat', chatWithUrl);

// Fetch chat history for URL endpoint
router.get('/chat/history', getChatHistory);