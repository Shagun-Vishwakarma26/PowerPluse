const mongoose = require('mongoose');

const meterSchema = new mongoose.Schema({
  meterId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  type: {
    type: String,
    enum: ['Smart Meter', 'Manual Meter'],
    default: 'Smart Meter'
  },
  currentReading: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Active', 'Warning', 'Offline'],
    default: 'Active'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Meter', meterSchema);
