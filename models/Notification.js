const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: [
        'HIGH_CONSUMPTION',
        'NEW_COMPLAINT',
        'COMPLAINT_ASSIGNED',
        'STATUS_CHANGE',
        'MANAGER_RESPONSE',
        'COMPLAINT_RESOLVED',
        'SYSTEM_UPDATE'
      ],
      default: 'SYSTEM_UPDATE'
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    relatedId: {
      type: String,
      default: ''
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Notification', notificationSchema);
