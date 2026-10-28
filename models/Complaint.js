const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderRole: {
    type: String,
    enum: ['Admin', 'Manager', 'Viewer'],
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const activitySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  performedBy: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'System'
  },
  details: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Please provide complaint title'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Please select a complaint category'],
      enum: [
        'Incorrect electricity reading',
        'High electricity consumption',
        'Meter or sensor issue',
        'Dashboard or login issue',
        'Other'
      ]
    },
    description: {
      type: String,
      required: [true, 'Please provide problem description'],
      trim: true
    },
    viewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    viewerName: {
      type: String,
      required: true
    },
    viewerEmail: {
      type: String,
      default: ''
    },
    assignedManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    assignedManagerName: {
      type: String,
      default: 'Unassigned'
    },
    location: {
      type: String,
      required: true,
      index: true
    },
    meterId: {
      type: String,
      default: 'N/A'
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium'
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Resolved', 'Rejected'],
      default: 'Pending',
      index: true
    },
    managerResponse: {
      type: String,
      default: ''
    },
    resolutionDetails: {
      type: String,
      default: ''
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    messages: [messageSchema],
    activityLog: [activitySchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Complaint', complaintSchema);
