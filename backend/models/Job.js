import mongooseInstance from '../config/db.js';

const JobSchema = new mongooseInstance.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  budget: {
    type: Number,
    required: true,
    min: 1
  },
  category: {
    type: String,
    required: true,
    default: 'Development & IT'
  },
  skills: {
    type: [String],
    default: []
  },
  deadline: {
    type: String,
    default: ''
  },
  client: {
    type: String, // User ID of Buyer
    required: true,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['open', 'active', 'completed', 'cancelled'],
    default: 'open'
  },
  deliverables: {
    type: String,
    default: ''
  },
  hiredFreelancer: {
    type: String, // User ID of Freelancer
    ref: 'User',
    default: null
  },
  submission: {
    text: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    submittedAt: { type: String, default: null }
  }
}, {
  timestamps: true
});

const Job = mongooseInstance.model('Job', JobSchema);
export default Job;
