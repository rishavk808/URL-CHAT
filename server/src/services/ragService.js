import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';



// In-Memory Fallback Storage (when MongoDB is offline/unreachable)
const inMemoryDocuments = new Map();
const inMemoryChatHistory = [];
const inMemoryChunksMap = new Map(); // Stores text chunks per URL for fallback similarity matching

let atlasVectorStore = null;
let memoryVectorStore = null;
let embeddingsEngine = null;

const CHUNKS_COLLECTION = 'chunks';
const VECTOR_INDEX_NAME = 'vector_index';

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Initialize Embeddings
 */
const getEmbeddingsEngine = () => {
  if (!embeddingsEngine) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY environment variable is not configured.');
    }
    embeddingsEngine = new GoogleGenerativeAIEmbeddings({
      apiKey,
      model: process.env.GOOGLE_EMBEDDING_MODEL || 'models/gemini-embedding-001'
    });
  }
  return embeddingsEngine;
};
const getVectorStore = async () => {
  const embeddings = getEmbeddingsEngine();

  if (isDbConnected()) {
    if (!atlasVectorStore) {
      const collection = mongoose.connection.collection(CHUNKS_COLLECTION);
      atlasVectorStore = new MongoDBAtlasVectorSearch(embeddings, {
        collection,
        indexName: VECTOR_INDEX_NAME,
        textKey: 'text',
        embeddingKey: 'embedding'
      });
    }
    return atlasVectorStore;
  }

  if (!memoryVectorStore) {
    memoryVectorStore = new MemoryVectorStore(embeddings);
  }
  return memoryVectorStore;
};