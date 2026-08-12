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