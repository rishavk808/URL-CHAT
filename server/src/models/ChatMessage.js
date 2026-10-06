import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  sources: {
    type: [
      {
        pageContent: String,
        metadata: mongoose.Schema.Types.Mixed
      }
    ],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Every history fetch queries by (userId, url) — index the pair together,
// ordered by time, rather than indexing url alone.
ChatMessageSchema.index({ userId: 1, url: 1, createdAt: 1 });

export default mongoose.model('ChatMessage', ChatMessageSchema);
