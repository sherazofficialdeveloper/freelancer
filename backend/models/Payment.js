import mongooseInstance from '../config/db.js';

const PaymentSchema = new mongooseInstance.Schema({
  job: {
    type: String, // Job ID
    required: true,
    ref: 'Job'
  },
  payer: {
    type: String, // User ID of the Buyer
    required: true,
    ref: 'User'
  },
  receiver: {
    type: String, // User ID of the Freelancer
    required: true,
    ref: 'User'
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['escrow', 'released', 'refunded'],
    default: 'escrow'
  }
}, {
  timestamps: true
});

const Payment = mongooseInstance.model('Payment', PaymentSchema);
export default Payment;
