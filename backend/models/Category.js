import mongooseInstance from '../config/db.js';

const CategorySchema = new mongooseInstance.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: 'lucide-layout-grid'
  }
}, {
  timestamps: true
});

const Category = mongooseInstance.model('Category', CategorySchema);
export default Category;
