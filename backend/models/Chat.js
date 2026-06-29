import mongooseInstance from '../config/db.js';

const ChatSchema = new mongooseInstance.Schema({
  chatId: {
    type: String,
    required: true,
    index: true
  },
  jobId: {
    type: String,
    ref: 'Job',
    required: true
  },
  senderId: {
    type: String,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: String,
    ref: 'User',
    required: true
  },
  // Backward compatibility fields
  sender: {
    type: String,
    ref: 'User',
    required: true
  },
  receiver: {
    type: String,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  },
  fileSize: {
    type: Number,
    default: 0
  },
  isDelivered: {
    type: Boolean,
    default: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Chat = mongooseInstance.model('Chat', ChatSchema);
export default Chat;
