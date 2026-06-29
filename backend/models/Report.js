import mongooseInstance from '../config/db.js';

const ReportSchema = new mongooseInstance.Schema({
  job: {
    type: String,
    ref: 'Job',
    default: null
  },
  reporter: {
    type: String,
    ref: 'User',
    required: true
  },
  reported: {
    type: String,
    ref: 'User',
    default: null
  },
  reason: {
    type: String,
    required: true, // e.g. Dispute, Scam, Abusive behavior, Late delivery
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'investigating', 'resolved', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
});

const Report = mongooseInstance.model('Report', ReportSchema);
export default Report;
