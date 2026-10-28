const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  systemName: {
    type: String,
    default: 'PowerPulse – Smart Electricity Monitoring System'
  },
  defaultLocation: {
    type: String,
    default: 'Main Building'
  },
  currency: {
    type: String,
    default: '₹'
  },
  timeZone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  highConsumptionThreshold: {
    type: Number,
    default: 150 // 150% of historical average
  },
  criticalConsumptionThreshold: {
    type: Number,
    default: 200 // 200% of historical average
  },
  electricityRate: {
    type: Number,
    default: 8.5 // ₹8.5 per kWh
  },
  enableAlerts: {
    type: Boolean,
    default: true
  },
  enableHighAlerts: {
    type: Boolean,
    default: true
  },
  enableCriticalAlerts: {
    type: Boolean,
    default: true
  },
  theme: {
    type: String,
    enum: ['dark', 'light'],
    default: 'dark'
  },
  density: {
    type: String,
    enum: ['comfortable', 'compact'],
    default: 'comfortable'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Setting', settingSchema);
