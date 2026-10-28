const express = require('express');
const router = express.Router();
const Meter = require('../models/Meter');
const Location = require('../models/Location');
const Reading = require('../models/Reading');
const { authorize } = require('../middleware/auth');

// @route   GET /api/meters
// @desc    Get meters visible to the current role, optionally filtered by location
router.get('/', async (req, res) => {
  try {
    const { location } = req.query;
    const query = {};

    if (req.user.role === 'Viewer') {
      const viewerLocs = req.user.assignedLocations && req.user.assignedLocations.length > 0
        ? req.user.assignedLocations
        : ['Mumbai - BKC Distribution Hub'];
      query.location = { $in: viewerLocs };
    } else if (req.user.role === 'Manager' || req.user.role === 'Admin') {
      if (location && location !== 'all') {
        query.location = location;
      }
    }

    const meters = await Meter.find(query).populate('ownerId', 'name email').sort({ meterId: 1 });

    res.json({ success: true, count: meters.length, meters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/meters/:id
router.get('/:id', async (req, res) => {
  try {
    const meter = await Meter.findById(req.params.id).populate('ownerId', 'name email');
    if (!meter) {
      return res.status(404).json({ success: false, message: 'Meter not found' });
    }

    if (req.user.role === 'Viewer') {
      const viewerLocs = req.user.assignedLocations || [];
      if (!viewerLocs.includes(meter.location)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.json({ success: true, meter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/meters (Admin & Manager for their locations)
router.post('/', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { meterId, location, type, status, currentReading } = req.body;

    if (!meterId || !location) {
      return res.status(400).json({ success: false, message: 'Meter ID and Location are required' });
    }

    const existing = await Meter.findOne({ meterId: meterId.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Meter ID already exists' });
    }

    const newMeter = await Meter.create({
      meterId: meterId.trim(),
      location: location.trim(),
      type: type || 'Smart Meter',
      status: status || 'Active',
      currentReading: currentReading ? Number(currentReading) : 0,
      lastUpdated: new Date()
    });

    // Increment location meterCount
    await Location.findOneAndUpdate(
      { name: location.trim() },
      { $inc: { meterCount: 1 } }
    );

    res.status(201).json({
      success: true,
      message: 'Meter added successfully',
      meter: newMeter
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/meters/:id
router.put('/:id', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { type, status, currentReading, location } = req.body;
    const meter = await Meter.findById(req.params.id);

    if (!meter) {
      return res.status(404).json({ success: false, message: 'Meter not found' });
    }

    if (type) meter.type = type;
    if (status) meter.status = status;
    if (currentReading !== undefined) meter.currentReading = Number(currentReading);
    if (location && req.user.role === 'Admin') meter.location = location;
    meter.lastUpdated = new Date();

    await meter.save();

    res.json({
      success: true,
      message: 'Meter updated successfully',
      meter
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/meters/:id (Admin only)
router.delete('/:id', authorize('Admin'), async (req, res) => {
  try {
    const meter = await Meter.findById(req.params.id);
    if (!meter) {
      return res.status(404).json({ success: false, message: 'Meter not found' });
    }

    await Location.findOneAndUpdate(
      { name: meter.location },
      { $inc: { meterCount: -1 } }
    );

    await meter.deleteOne();
    res.json({ success: true, message: 'Meter deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
