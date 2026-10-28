const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['High Consumption', 'Critical Consumption', 'Sudden Increase', 'Meter Issue', 'System Alert'],
    required: true
  },
  severity: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    required: true
  },
  location: {
    type: String,
    required: true
  },
  meterId: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  consumption: {
    type: Number,
    required: true
  },
  threshold: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['New', 'Acknowledged', 'Resolved'],
    default: 'New'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Alert', alertSchema);
