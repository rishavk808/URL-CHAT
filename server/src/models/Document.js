import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    default: 'Untitled Webpage'
  },
  chunkCount: {
    type: Number,
    required: true,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// A URL can be indexed independently by different users, but not twice by the
// same user. This replaces the old global-unique constraint on `url` alone —
// see server/scripts/migrateToUserAccounts.js for the one-time index migration.
DocumentSchema.index({ userId: 1, url: 1 }, { unique: true });

export default mongoose.model('Document', DocumentSchema);
