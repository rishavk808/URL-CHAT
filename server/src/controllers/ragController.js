import {
  processAndIndexUrl,
  queryRagChain,
  removeDocumentFromStore,
  getStoredDocuments,
  getStoredChatHistory
} from '../services/ragService.js';
import DocumentModel from '../models/Document.js';
import mongoose from 'mongoose';

/**
 * @desc Ingest & index URL content
 * @route POST /api/ingest
 */
export const ingestUrl = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({
        error: 'A valid URL string is required.'
      });
    }

    let validatedUrl = url.trim();
    if (!validatedUrl.startsWith('http://') && !validatedUrl.startsWith('https://')) {
      validatedUrl = `https://${validatedUrl}`;
    }

    try {
      new URL(validatedUrl);
    } catch {
      return res.status(400).json({
        error: 'Invalid URL format. Please provide a valid web address (e.g., https://example.com).'
      });
    }

    console.log(`[Ingest API] Starting pipeline for URL: ${validatedUrl}`);
    const result = await processAndIndexUrl(validatedUrl);

    return res.status(200).json({
      success: true,
      documentId: result.documentId || result._id,
      url: result.url,
      title: result.title,
      chunkCount: result.chunkCount,
      createdAt: result.createdAt
    });
  } catch (error) {
    console.error('[Ingest API Error]:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred during URL ingestion.'
    });
  }
};

/**
 * @desc Query RAG pipeline for active URL context
 * @route POST /api/chat
 */
export const chatWithUrl = async (req, res) => {
  try {
    const { url, question } = req.body;

    if (!url || !question || !question.trim()) {
      return res.status(400).json({
        error: 'Both "url" and "question" parameters are required.'
      });
    }

    console.log(`[Chat API] Querying context for "${url}" with question: "${question}"`);
    const result = await queryRagChain(url.trim(), question.trim());

    return res.status(200).json({
      answer: result.answer,
      sources: result.sources
    });
  } catch (error) {
    console.error('[Chat API Error]:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred while generating the answer.'
    });
  }
};

/**
 * @desc Get all indexed document records
 * @route GET /api/documents
 */
export const getAllDocuments = async (req, res) => {
  try {
    const documents = await getStoredDocuments();
    return res.status(200).json({
      success: true,
      documents
    });
  } catch (error) {
    console.error('[Get Documents Error]:', error);
    return res.status(500).json({
      error: 'Failed to retrieve indexed document records.'
    });
  }
};

/**
 * @desc Delete document by ID and clear its vectors
 * @route DELETE /api/documents/:id
 */
export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    let targetUrl = null;
    if (mongoose.connection.readyState === 1) {
      const doc = await DocumentModel.findById(id);
      if (doc) targetUrl = doc.url;
    }

    if (!targetUrl) {
      const allDocs = await getStoredDocuments();
      const match = allDocs.find((d) => String(d._id) === String(id) || String(d.documentId) === String(id));
      if (match) targetUrl = match.url;
    }

    if (!targetUrl) {
      return res.status(404).json({
        error: 'Document record not found.'
      });
    }

    await removeDocumentFromStore(targetUrl);

    return res.status(200).json({
      success: true,
      message: 'Document and vectors deleted successfully.',
      deletedId: id
    });
  } catch (error) {
    console.error('[Delete Document Error]:', error);
    return res.status(500).json({
      error: 'Failed to delete document record.'
    });
  }
};

/**
 * @desc Get saved chat history for a specific URL
 * @route GET /api/chat/history
 */
export const getChatHistory = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL query parameter is required.' });
    }

    const history = await getStoredChatHistory(url);
    return res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    console.error('[Get Chat History Error]:', error);
    return res.status(500).json({
      error: 'Failed to fetch chat history for the specified URL.'
    });
  }
};
