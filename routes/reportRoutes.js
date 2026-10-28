const express = require('express');
const router = express.Router();
const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const Setting = require('../models/Setting');

// @route   GET /api/reports
// @desc    Generate comprehensive report data for date range, location & meter
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, location, meterId, range = '30days' } = req.query;

    const query = req.user.role === 'Viewer' ? { ownerId: req.user._id } : {};

    if (location && location !== 'all') query.location = location;
    if (meterId && meterId !== 'all') query.meterId = meterId;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    } else {
      // Default timeframe
      const now = new Date();
      let start = new Date();
      if (range === 'daily') start.setDate(now.getDate() - 1);
      else if (range === 'weekly') start.setDate(now.getDate() - 7);
      else if (range === 'monthly') start.setDate(now.getDate() - 30);
      else start.setDate(now.getDate() - 30);

      query.timestamp = { $gte: start };
    }

    const readings = await Reading.find(query).sort({ timestamp: 1 });
    const alerts = await Alert.find({
      createdAt: { $gte: query.timestamp?.$gte || new Date(0) }
    }).sort({ createdAt: -1 });

    const totalConsumption = Math.round(readings.reduce((sum, r) => sum + r.consumption, 0));
    const totalCost = Math.round(readings.reduce((sum, r) => sum + r.cost, 0));
    const avgConsumption = readings.length > 0 ? Math.round((totalConsumption / readings.length) * 10) / 10 : 0;

    let peakConsumption = 0;
    let minConsumption = readings.length > 0 ? Infinity : 0;

    readings.forEach(r => {
      if (r.consumption > peakConsumption) peakConsumption = r.consumption;
      if (r.consumption < minConsumption) minConsumption = r.consumption;
    });

    if (minConsumption === Infinity) minConsumption = 0;

    // Location breakdown
    const locationMap = {};
    readings.forEach(r => {
      if (!locationMap[r.location]) {
        locationMap[r.location] = { consumption: 0, cost: 0, count: 0 };
      }
      locationMap[r.location].consumption += r.consumption;
      locationMap[r.location].cost += r.cost;
      locationMap[r.location].count += 1;
    });

    const locationSummary = Object.keys(locationMap).map(loc => ({
      location: loc,
      consumption: Math.round(locationMap[loc].consumption),
      cost: Math.round(locationMap[loc].cost),
      percentage: totalConsumption > 0 ? Math.round((locationMap[loc].consumption / totalConsumption) * 1000) / 10 : 0
    }));

    const setting = await Setting.findOne();
    const canViewAlerts = req.user.role !== 'Viewer';

    res.json({
      success: true,
      reportMetaData: {
        title: 'Electricity Monitoring & Energy Analysis Report',
        generatedAt: new Date().toLocaleString(),
        dateRange: `${startDate || '30 Days Ago'} to ${endDate || 'Today'}`,
        filterLocation: location || 'All Locations',
        filterMeter: meterId || 'All Meters',
        currency: setting ? setting.currency : '₹'
      },
      summary: {
        totalConsumption,
        avgConsumption,
        peakConsumption,
        minConsumption,
        totalCost,
        totalReadings: readings.length,
        totalAlerts: canViewAlerts ? alerts.length : undefined
      },
      locationSummary,
      alerts: canViewAlerts ? alerts.slice(0, 10) : [],
      readings: readings.slice(-50)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
