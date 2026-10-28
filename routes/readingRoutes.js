const express = require('express');
const router = express.Router();
const Reading = require('../models/Reading');
const Meter = require('../models/Meter');
const Location = require('../models/Location');
const Setting = require('../models/Setting');
const { checkReadingForAlerts } = require('../utils/alertDetector');
const { authorize } = require('../middleware/auth');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// Helper to determine query filter for user role
const getQueryForRole = (user, queryParams) => {
  const query = {};
  const {
    location,
    meterId,
    readingType,
    startDate,
    endDate,
    minConsumption,
    maxConsumption,
    search
  } = queryParams;

  if (user.role === 'Viewer') {
    const locs = user.assignedLocations && user.assignedLocations.length > 0
      ? user.assignedLocations
      : ['Mumbai - BKC Distribution Hub'];
    query.location = { $in: locs };
  } else if (user.role === 'Manager' || user.role === 'Admin') {
    if (location && location !== 'all') {
      query.location = location;
    }
  }

  if (meterId && meterId !== 'all') {
    query.meterId = meterId;
  }

  if (readingType && readingType !== 'all') {
    query.readingType = readingType;
  }

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }

  if (minConsumption !== undefined || maxConsumption !== undefined) {
    query.consumption = {};
    if (minConsumption) query.consumption.$gte = Number(minConsumption);
    if (maxConsumption) query.consumption.$lte = Number(maxConsumption);
  }

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    query.$or = [
      { meterId: searchRegex },
      { location: searchRegex },
      { notes: searchRegex }
    ];
  }

  return query;
};

// @route   GET /api/readings
// @desc    Get electricity readings with filtering & pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const query = getQueryForRole(req.user, req.query);

    const total = await Reading.countDocuments(query);
    const readings = await Reading.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      count: readings.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      readings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/readings
// @desc    Add a manual reading or simulate IoT telemetry (Admin & Manager only)
router.post('/', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const {
      location,
      meterId,
      date,
      time,
      consumption,
      readingType = 'Smart Meter',
      notes = ''
    } = req.body;

    if (typeof meterId !== 'string' || !meterId.trim() || consumption === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Meter ID and Consumption are required'
      });
    }

    const numericConsumption = Number(consumption);
    if (!Number.isFinite(numericConsumption) || numericConsumption < 0) {
      return res.status(400).json({
        success: false,
        message: 'Consumption must be a valid non-negative number'
      });
    }

    const meter = await Meter.findOne({ meterId: meterId.trim() });
    if (!meter) {
      return res.status(404).json({ success: false, message: 'Meter not found' });
    }

    if (location && location !== meter.location) {
      return res.status(400).json({
        success: false,
        message: 'The selected location does not match this meter'
      });
    }

    const indiaNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString();
    const readingDate = date || indiaNow.slice(0, 10);
    const readingTime = time || indiaNow.slice(11, 16);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(readingDate) || !/^\d{2}:\d{2}$/.test(readingTime)) {
      return res.status(400).json({ success: false, message: 'Date or time is invalid' });
    }
    const [year, month, day] = readingDate.split('-').map(Number);
    const [hour, minute] = readingTime.split(':').map(Number);
    const calendarDate = new Date(Date.UTC(year, month - 1, day));
    if (
      calendarDate.getUTCFullYear() !== year ||
      calendarDate.getUTCMonth() !== month - 1 ||
      calendarDate.getUTCDate() !== day ||
      hour > 23 ||
      minute > 59
    ) {
      return res.status(400).json({ success: false, message: 'Date or time is invalid' });
    }
    const timestamp = new Date(`${readingDate}T${readingTime}:00+05:30`);
    if (Number.isNaN(timestamp.getTime())) {
      return res.status(400).json({ success: false, message: 'Date or time is invalid' });
    }
    const rate = 8.5;
    const cost = Math.round(numericConsumption * rate * 100) / 100;

    const newReading = await Reading.create({
      location: meter.location,
      meterId: meter.meterId,
      ownerId: req.user._id,
      date: readingDate,
      time: readingTime,
      timestamp,
      consumption: numericConsumption,
      cost,
      readingType,
      dataSource: readingType === 'Manual' ? 'Manual' : 'Simulated',
      notes
    });

    // Update meter latest reading
    await Meter.findByIdAndUpdate(
      meter._id,
      {
        currentReading: numericConsumption,
        lastUpdated: new Date()
      }
    );

    // Run alert detector
    const alertResult = await checkReadingForAlerts(newReading);

    res.status(201).json({
      success: true,
      message: 'Reading recorded successfully',
      reading: newReading,
      alert: alertResult
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/readings/:id (Admin only)
router.delete('/:id', authorize('Admin'), async (req, res) => {
  try {
    const reading = await Reading.findById(req.params.id);
    if (!reading) {
      return res.status(404).json({ success: false, message: 'Reading not found' });
    }

    await reading.deleteOne();
    res.json({ success: true, message: 'Reading deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
