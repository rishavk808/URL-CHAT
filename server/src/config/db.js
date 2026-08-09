import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.warn('[MongoDB] MONGO_URI is not set. Running in memory-only mode.');
      return;
    }

    console.log('[MongoDB] Attempting connection to MongoDB Atlas...');
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`[MongoDB] Warning - Connection failed (${error.message}).`);
    console.warn(`[MongoDB] Server will continue running in in-memory vector store mode.`);
  }
};
