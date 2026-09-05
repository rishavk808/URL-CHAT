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

    // Extract text from main or body
    let rawText = '';
    if ($('main').length > 0) {
      rawText = $('main').text();
    } else if ($('article').length > 0) {
      rawText = $('article').text();
    } else {
      rawText = $('body').text();
    }

    // Clean whitespace
    const cleanedText = rawText
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    if (!cleanedText || cleanedText.length < 50) {
      throw new Error('Could not extract sufficient readable text from the provided URL.');
    }

    return { title, text: cleanedText };
  } catch (error) {
    if (error.response) {
      throw new Error(`Failed to scrape URL (HTTP ${error.response.status}): ${error.response.statusText}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Webpage request timed out. Please verify the URL and try again.');
    }
    throw new Error(`Scraping error: ${error.message}`);
  }
};

/**
 * Ingest URL into vector store and database
 */
export const processAndIndexUrl = async (url) => {
  // Step 1: Scrape
  const { title, text } = await scrapeAndCleanUrl(url);

  // Step 2: Chunk
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
  });

  const rawDocs = await splitter.createDocuments([text], [{ url, title }]);
  const chunkCount = rawDocs.length;

  // Add chunk metadata index
  const docs = rawDocs.map((doc, idx) => {
    return new LangChainDocument({
      pageContent: doc.pageContent,
      metadata: {
        url,
        title,
        chunkIndex: idx,
        totalChunks: chunkCount
      }
    });
  });

  // Store chunks in fallback memory map
  inMemoryChunksMap.set(url, docs);

  // Step 3 & 4: Embed & Index into Vector Store
  try {
    const store = await getVectorStore();
    await removeUrlFromVectorStore(url); // avoid duplicate chunks if this URL was already indexed
    await store.addDocuments(docs);
  } catch (embedError) {
    console.warn(`[VectorStore Indexing Notice]: Embedding API warning (${embedError.message}). Fallback chunk index active.`);
  }

  // Save to DB or In-Memory fallback
  let docData;
  if (isDbConnected()) {
    const savedDoc = await DocumentModel.findOneAndUpdate(
      { url },
      { title, chunkCount, createdAt: new Date() },
      { upsert: true, new: true }
    );
    docData = {
      documentId: savedDoc._id,
      url: savedDoc.url,
      title: savedDoc.title,
      chunkCount: savedDoc.chunkCount,
      createdAt: savedDoc.createdAt
    };
  } else {
    const memId = `mem_${Date.now()}`;
    docData = {
      documentId: memId,
      _id: memId,
      url,
      title,
      chunkCount,
      createdAt: new Date()
    };
    inMemoryDocuments.set(url, docData);
  }

  return docData;
};

/**
 * Keyword & Text Relevance Fallback Search
 */
const performTextRelevanceSearch = (url, question, k = 4) => {
  const docs = inMemoryChunksMap.get(url) || [];
  if (docs.length === 0) return [];

  const queryTerms = question.toLowerCase().split(/\W+/).filter(t => t.length > 2);

  const scoredDocs = docs.map(doc => {
    const textLower = doc.pageContent.toLowerCase();
    let score = 0;
    queryTerms.forEach(term => {
      if (textLower.includes(term)) {
        score += 1;
      }
    });
    return { doc, score };
  });

  scoredDocs.sort((a, b) => b.score - a.score);
  
  // Return top K docs (or first K docs if all scores 0)
  return scoredDocs.slice(0, k).map(item => item.doc);
};

/**
 * Answer chat question using RAG similarity search and Gemini-1.5-Flash
 */
export const queryRagChain = async (url, question) => {
  let filteredDocs = [];

  // Try Vector Store similarity search
  try {
    const store = await getVectorStore();
    const searchResults = await store.similaritySearch(question, 15);
    filteredDocs = searchResults.filter((doc) => doc.metadata && doc.metadata.url === url).slice(0, 4);
  } catch (err) {
    console.warn(`[Vector Search Warning]: ${err.message}. Using fallback relevance index.`);
  }

  // Fallback to text relevance search if vector search returned no results
  if (!filteredDocs || filteredDocs.length === 0) {
    filteredDocs = performTextRelevanceSearch(url, question, 4);
  }

  // Format context string
  const contextText = filteredDocs
    .map((doc, index) => `[Source Chunk ${index + 1}]\n${doc.pageContent}`)
    .join('\n\n');

  if (!contextText || filteredDocs.length === 0) {
    const fallbackAnswer = "I could not find relevant information in the provided URL. Please make sure the URL has been properly indexed.";
    
    // Save to Chat History
    if (isDbConnected()) {
      await ChatMessageModel.create({ url, role: 'user', content: question });
      await ChatMessageModel.create({ url, role: 'assistant', content: fallbackAnswer, sources: [] });
    } else {
      inMemoryChatHistory.push(
        { url, role: 'user', content: question, createdAt: new Date() },
        { url, role: 'assistant', content: fallbackAnswer, sources: [], createdAt: new Date() }
      );
    }

    return {
      answer: fallbackAnswer,
      sources: []
    };
  }

  // Prepare Gemini Model
  const apiKey = process.env.GOOGLE_API_KEY;
  const model = new ChatGoogleGenerativeAI({
    apiKey,
    model: process.env.GOOGLE_CHAT_MODEL || 'models/gemini-3.6-flash',
    temperature: 0.2
  });

    const promptTemplate = ChatPromptTemplate.fromMessages([
    [
      'system',
      `You are an AI assistant helping users answer questions based strictly on the provided website content context.

Rules:
1. Answer questions strictly based on the provided context below.
2. If the context lacks sufficient info, state strictly: "I could not find relevant information in the provided URL."
3. Do not assume or extrapolate facts not present in the context.
4. Format your answer with clear markdown (bold headers, bullet points, tables, code blocks) when appropriate.

Context:
{context}`
    ],
    ['human', '{question}']
  ]);

    const formattedPrompt = await promptTemplate.formatMessages({
    context: contextText,
    question
  });

  const response = await model.invoke(formattedPrompt);
  const answer = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

  // Extract source excerpts for response
  const sources = filteredDocs.map((doc) => ({
    pageContent: doc.pageContent,
    metadata: doc.metadata
  }));

    // Save to Chat History
  if (isDbConnected()) {
    await ChatMessageModel.create({ url, role: 'user', content: question });
    await ChatMessageModel.create({ url, role: 'assistant', content: answer, sources });
  } else {
    inMemoryChatHistory.push(
      { url, role: 'user', content: question, createdAt: new Date() },
      { url, role: 'assistant', content: answer, sources, createdAt: new Date() }
    );
  }

  return {
    answer,
    sources
  };
};
