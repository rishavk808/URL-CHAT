import axios from 'axios';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
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