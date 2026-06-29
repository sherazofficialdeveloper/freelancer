import mongooseInstance from '../config/db.js';

const NotificationSchema = new mongooseInstance.Schema({
  userId: {
    type: String,
    required: true,
    ref: 'User',
    index: true
  },
  type: {
    type: String,
    enum: [
      'job_posted',
      'bid_received',
      'bid_accepted',
      'message_received',
      'payment_released',
      'system_alert'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Notification = mongooseInstance.model('Notification', NotificationSchema);
export default Notification;
