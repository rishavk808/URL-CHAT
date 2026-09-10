import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const CHUNKS_COLLECTION = 'chunks';
const VECTOR_INDEX_NAME = 'vector_index';
const EMBEDDING_DIMENSIONS = 3072; // models/gemini-embedding-001 output size

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI environment variable is not configured.');
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const existingCollections = await db.listCollections({ name: CHUNKS_COLLECTION }).toArray();
  if (existingCollections.length === 0) {
    await db.createCollection(CHUNKS_COLLECTION);
    console.log(`Created "${CHUNKS_COLLECTION}" collection.`);
  }

  const collection = db.collection(CHUNKS_COLLECTION);
  const existingIndexes = await collection.listSearchIndexes(VECTOR_INDEX_NAME).toArray().catch(() => []);

  if (existingIndexes.length > 0) {
    console.log(`Vector search index "${VECTOR_INDEX_NAME}" already exists on "${CHUNKS_COLLECTION}". Nothing to do.`);
  } else {
    await collection.createSearchIndex({
      name: VECTOR_INDEX_NAME,
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: EMBEDDING_DIMENSIONS,
            similarity: 'cosine'
          }
        ]
      }
    });
    console.log(`Created vector search index "${VECTOR_INDEX_NAME}" on "${CHUNKS_COLLECTION}".`);
    console.log('Atlas may take a minute or two to finish building the index before it is queryable.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed to set up vector index:', err.message);
  process.exit(1);
});
