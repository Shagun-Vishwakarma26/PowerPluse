const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const Meter = require('../models/Meter');
const Location = require('../models/Location');
const User = require('../models/User');
const seedDatabase = require('../utils/seedData');
const { authorize } = require('../middleware/auth');

// @route   GET /api/settings
router.get('/', authorize('Admin'), async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({});
    }
    res.json({ success: true, settings: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/settings
router.put('/', authorize('Admin'), async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting();
    }

    const fields = [
      'systemName', 'defaultLocation', 'currency', 'timeZone',
      'highConsumptionThreshold', 'criticalConsumptionThreshold',
      'electricityRate', 'enableAlerts', 'enableHighAlerts',
      'enableCriticalAlerts', 'theme', 'density'
    ];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        setting[field] = req.body[field];
      }
    });

    setting.updatedAt = new Date();
    await setting.save();

    res.json({ success: true, message: 'Settings updated successfully', settings: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/settings/reset-demo
// @desc    Clear database and re-seed with clean realistic demo data
router.post('/reset-demo', authorize('Admin'), async (req, res) => {
  try {
    await Reading.deleteMany({});
    await Alert.deleteMany({});
    await Meter.deleteMany({});
    await Location.deleteMany({});
    await User.deleteMany({});
    await Setting.deleteMany({});

    await seedDatabase();

    res.json({ success: true, message: 'Database reset and demo data re-seeded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
