import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    index: true
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

export default mongoose.model('ChatMessage', ChatMessageSchema);
