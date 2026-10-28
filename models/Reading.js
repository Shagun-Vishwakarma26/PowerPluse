const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema(
  {
    location: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    meterId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
      index: true
    },
    time: {
      type: String, // Format: HH:MM
      required: true
    },
    timestamp: {
      type: Date,
      required: true,
      index: true
    },
    consumption: {
      type: Number,
      required: true,
      min: [0, 'Consumption cannot be negative']
    },
    cost: {
      type: Number,
      required: true,
      min: [0, 'Cost cannot be negative']
    },
    readingType: {
      type: String,
      enum: ['Manual', 'Smart Meter', 'Imported', 'Simulated'],
      default: 'Smart Meter'
    },
    dataSource: {
      type: String,
      enum: ['Simulated', 'Real', 'Manual'],
      default: 'Simulated'
    },
    notes: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Reading', readingSchema);
