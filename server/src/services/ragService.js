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

 //Remove previously indexed chunks for a URL from whichever vector store backend is active
 
const removeUrlFromVectorStore = async (url) => {
  if (isDbConnected()) {
    await mongoose.connection.collection(CHUNKS_COLLECTION).deleteMany({ url });
  } else if (memoryVectorStore && memoryVectorStore.memoryVectors) {
    memoryVectorStore.memoryVectors = memoryVectorStore.memoryVectors.filter(
      (v) => v.metadata && v.metadata.url !== url
    );
  }
};

/**
 * Scrape webpage using Axios and Cheerio, stripping non-content tags
 */
export const scrapeAndCleanUrl = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const html = response.data;
    const $ = cheerio.load(html);

    // Extract Title (use only the document's own <title>, not stray <title> nodes
    // inside inline SVG icons, and collapse any internal whitespace/newlines)
    const title =
      $('head > title').first().text().replace(/\s+/g, ' ').trim() ||
      $('h1').first().text().replace(/\s+/g, ' ').trim() ||
      $('meta[property="og:title"]').attr('content') ||
      url;
       // Strip script, style, nav, footer, header, aside, iframe, noscript, etc.
    $('script, style, nav, footer, header, aside, iframe, noscript, svg, form').remove();
    }

catch{

}
};