import mongooseInstance from '../config/db.js';

const WalletSchema = new mongooseInstance.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    ref: 'User'
  },
  balance: {
    type: Number,
    default: 1000 // Starter money for demo/testing
  },
  pendingBalance: {
    type: Number,
    default: 0 // held in escrow
  },
  totalEarned: {
    type: Number,
    default: 0 // total ever earned by freelancer
  }
}, {
  timestamps: true
});

const Wallet = mongooseInstance.model('Wallet', WalletSchema);
export default Wallet;
