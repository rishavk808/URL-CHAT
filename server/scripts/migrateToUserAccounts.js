/**
 * One-time migration for adding user accounts to an existing deployment.
 *
 * Run this ONCE, after deploying the user-accounts code, against the same
 * MONGO_URI the server uses:
 *
 *   node server/scripts/migrateToUserAccounts.js
 *
 * What it does:
 * 1. Drops the old global-unique index on documents.url. That index predates
 *    user accounts and enforced "this URL can only be indexed once, by
 *    anyone" — which would block two different users from both indexing the
 *    same page. Document.js now defines a compound unique index on
 *    (userId, url) instead; Mongoose creates that one automatically on
 *    connect, but it does NOT drop the old one, so both would otherwise
 *    coexist and the stale one would keep rejecting valid inserts.
 * 2. Reports any documents/chunks/chat messages created before accounts
 *    existed (no userId field). Nothing is deleted automatically — that data
 *    is harmless, just permanently invisible now, since every read filters
 *    by userId. Delete it yourself if you want a clean slate.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../src/config/db.js';

dotenv.config();

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is not configured.');
  }

  // Reuses the app's own connect logic, including its retry against public
  // DNS when the local resolver can't do the mongodb+srv:// SRV lookup.
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Could not connect to MongoDB.');
  }
  console.log('Connected to MongoDB.');
  const db = mongoose.connection.db;

  // 1. Drop the stale unique index on documents.url, if present.
  const docIndexes = await db.collection('documents').indexes();
  const staleUrlIndex = docIndexes.find(
    (idx) => JSON.stringify(idx.key) === JSON.stringify({ url: 1 }) && idx.unique
  );

  if (staleUrlIndex) {
    await db.collection('documents').dropIndex(staleUrlIndex.name);
    console.log(`Dropped stale unique index "${staleUrlIndex.name}" on documents.url.`);
  } else {
    console.log('No stale unique index found on documents.url — nothing to drop.');
  }

  // 2. Report pre-account data with no userId.
  const orphanedDocs = await db.collection('documents').countDocuments({ userId: { $exists: false } });
  const orphanedChunks = await db.collection('chunks').countDocuments({ userId: { $exists: false } }).catch(() => 0);
  const orphanedMessages = await db.collection('chatmessages').countDocuments({ userId: { $exists: false } });

  if (orphanedDocs || orphanedChunks || orphanedMessages) {
    console.log(
      `\nFound pre-account data with no userId: ${orphanedDocs} document(s), ` +
        `${orphanedChunks} chunk(s), ${orphanedMessages} chat message(s).\n` +
        'This data is harmless but now unreachable by any account (every read filters ' +
        'by userId). Delete it yourself if you want a clean slate, e.g. in mongosh:\n' +
        '  db.documents.deleteMany({ userId: { $exists: false } })\n' +
        '  db.chunks.deleteMany({ userId: { $exists: false } })\n' +
        '  db.chatmessages.deleteMany({ userId: { $exists: false } })'
    );
  } else {
    console.log('\nNo pre-account data found.');
  }

  await mongoose.disconnect();
  console.log('\nMigration check complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
