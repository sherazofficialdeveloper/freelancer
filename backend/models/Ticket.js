import mongooseInstance from '../config/db.js';

const TicketSchema = new mongooseInstance.Schema({
  user: {
    type: String,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  messages: [{
    sender: {
      type: String, // 'user' or 'admin' or username
      required: true
    },
    message: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

const Ticket = mongooseInstance.model('Ticket', TicketSchema);
export default Ticket;
