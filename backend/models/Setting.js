import mongooseInstance from '../config/db.js';

const SettingSchema = new mongooseInstance.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongooseInstance.Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

const Setting = mongooseInstance.model('Setting', SettingSchema);
export default Setting;
