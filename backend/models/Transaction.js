import mongooseInstance from '../config/db.js';

const TransactionSchema = new mongooseInstance.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  jobId: {
    type: String, // Job ID
    required: true,
    ref: 'Job'
  },
  buyerId: {
    type: String, // Payer ID
    required: true,
    ref: 'User'
  },
  freelancerId: {
    type: String, // Freelancer ID
    required: true,
    ref: 'User'
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_escrow', 'released', 'cancelled'],
    default: 'pending'
  }
}, {
  timestamps: true
});

const Transaction = mongooseInstance.model('Transaction', TransactionSchema);
export default Transaction;
