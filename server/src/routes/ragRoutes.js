import express from 'express';
import {
  ingestUrl,
  chatWithUrl,
  getAllDocuments,
  deleteDocument,
  getChatHistory
} from '../controllers/ragController.js';

const router = express.Router();

// Ingest webpage URL endpoint
router.post('/ingest', ingestUrl);

// Chat with indexed URL endpoint
router.post('/chat', chatWithUrl);

// Fetch chat history for URL endpoint
router.get('/chat/history', getChatHistory);

// Document metadata endpoints
router.get('/documents', getAllDocuments);
router.delete('/documents/:id', deleteDocument);

export default router;
