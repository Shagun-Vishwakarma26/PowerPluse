const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    city: {
      type: String,
      trim: true,
      default: ''
    },
    region: {
      type: String,
      trim: true,
      default: ''
    },
    address: {
      type: String,
      default: 'Industrial & Utility Zone'
    },
    assignedManager: {
      type: String,
      default: 'Unassigned'
    },
    assignedManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    meters: {
      type: [String],
      default: []
    },
    meterCount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['Active', 'Warning', 'Offline'],
      default: 'Active'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Location', locationSchema);
