import mongooseInstance from '../config/db.js';

const ServiceSchema = new mongooseInstance.Schema({
  owner: {
    type: String, // User ID of Freelancer
    required: true,
    ref: 'User'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 5
  },
  deliveryTime: {
    type: Number, // in Days
    required: true,
    min: 1
  },
  category: {
    type: String,
    required: true,
    default: 'Development & IT'
  },
  tags: {
    type: [String],
    default: []
  },
  imageUrl: {
    type: String,
    default: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80'
  },
  salesCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const Service = mongooseInstance.model('Service', ServiceSchema);
export default Service;
