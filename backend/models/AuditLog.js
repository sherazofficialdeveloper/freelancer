import mongooseInstance from '../config/db.js';

const AuditLogSchema = new mongooseInstance.Schema({
  action: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['success', 'warning', 'error', 'info'],
    default: 'info'
  },
  userId: {
    type: String,
    default: null
  },
  username: {
    type: String,
    default: 'System'
  }
}, {
  timestamps: true
});

const AuditLog = mongooseInstance.model('AuditLog', AuditLogSchema);
export default AuditLog;
