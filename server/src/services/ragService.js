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