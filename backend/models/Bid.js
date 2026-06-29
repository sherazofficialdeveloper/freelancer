import mongooseInstance from '../config/db.js';

const BidSchema = new mongooseInstance.Schema({
  job: {
    type: String, // Job ID
    required: true,
    ref: 'Job'
  },
  freelancer: {
    type: String, // User ID of Freelancer
    required: true,
    ref: 'User'
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  proposal: {
    type: String,
    required: true
  },
  deliveryDays: {
    type: Number,
    required: true,
    min: 1
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

const Bid = mongooseInstance.model('Bid', BidSchema);
export default Bid;
