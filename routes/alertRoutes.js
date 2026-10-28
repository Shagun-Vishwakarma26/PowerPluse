const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { authorize } = require('../middleware/auth');

// @route   GET /api/alerts
// @desc    Get alerts with optional location filters
router.get('/', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { status, severity, type, location } = req.query;
    const query = {};

    if (location && location !== 'all') {
      query.location = location;
    }

    if (status && status !== 'all') query.status = status;
    if (severity && severity !== 'all') query.severity = severity;
    if (type && type !== 'all') query.type = type;

    const alerts = await Alert.find(query).sort({ createdAt: -1 });

    const unresolvedFilter = { ...query, status: { $in: ['New', 'Acknowledged'] } };
    const unresolvedCount = await Alert.countDocuments(unresolvedFilter);

    res.json({
      success: true,
      count: alerts.length,
      unresolvedCount,
      alerts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/alerts/:id/status
// @desc    Update alert status (Acknowledged, Resolved, New)
router.put('/:id/status', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['New', 'Acknowledged', 'Resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid alert status' });
    }

    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    alert.status = status;
    await alert.save();

    res.json({
      success: true,
      message: `Alert status updated to ${status}`,
      alert
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
