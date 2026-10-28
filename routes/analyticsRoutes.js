const express = require('express');
const router = express.Router();
const Reading = require('../models/Reading');
const Meter = require('../models/Meter');
const Alert = require('../models/Alert');
const Setting = require('../models/Setting');
const Complaint = require('../models/Complaint');

// Helper to determine location query based on user role and query param
const getRoleLocationFilter = (user, explicitLocation) => {
  let filter = {};

  if (user.role === 'Viewer') {
    const userLocs = user.assignedLocations && user.assignedLocations.length > 0
      ? user.assignedLocations
      : ['Mumbai - BKC Distribution Hub'];
    filter.location = { $in: userLocs };
  } else if (user.role === 'Manager' || user.role === 'Admin') {
    if (explicitLocation && explicitLocation !== 'all') {
      filter.location = explicitLocation;
    }
  }

  return filter;
};

const getDateRangeFilter = (period) => {
  const now = new Date();
  let startDate = new Date();

  switch (period) {
    case 'day':
      startDate.setTime(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setDate(now.getDate() - 30);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case '7days':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30days':
      startDate.setDate(now.getDate() - 30);
      break;
    case '3months':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case '1year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }
  return startDate;
};

// @route   GET /api/analytics/summary
// @desc    Get top dashboard KPIs with role filtering
router.get('/summary', async (req, res) => {
  try {
    const { period = '30days', location } = req.query;
    const startDate = getDateRangeFilter(period);
    const locFilter = getRoleLocationFilter(req.user, location);

    const setting = (await Setting.findOne()) || {
      highConsumptionThreshold: 150,
      electricityRate: 8.5
    };

    const currentReadings = await Reading.find({
      ...locFilter,
      timestamp: { $gte: startDate }
    });

    const duration = Date.now() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - duration);
    const previousReadings = await Reading.find({
      ...locFilter,
      timestamp: { $gte: prevStartDate, $lt: startDate }
    });

    const totalConsumption = Math.round(currentReadings.reduce((acc, r) => acc + r.consumption, 0));
    const totalCost = Math.round(currentReadings.reduce((acc, r) => acc + r.cost, 0));
    const prevTotalConsumption = previousReadings.reduce((acc, r) => acc + r.consumption, 0);

    let consumptionChangePct = 0;
    if (prevTotalConsumption > 0) {
      consumptionChangePct = Math.round(((totalConsumption - prevTotalConsumption) / prevTotalConsumption) * 1000) / 10;
    }

    const daysCount = Math.max(1, Math.ceil(duration / (1000 * 60 * 60 * 24)));
    const avgConsumption = Math.round(totalConsumption / daysCount);

    let peakConsumption = 0;
    currentReadings.forEach((r) => {
      if (r.consumption > peakConsumption) peakConsumption = r.consumption;
    });

    // Meters count
    let meterQuery = {};
    if (locFilter.location) meterQuery.location = locFilter.location;
    const activeMetersCount = await Meter.countDocuments({ ...meterQuery, status: { $ne: 'Offline' } });

    // Alerts count
    let alertQuery = { status: { $in: ['New', 'Acknowledged'] } };
    if (locFilter.location) alertQuery.location = locFilter.location;
    const activeAlertsCount = req.user.role === 'Viewer'
      ? 0
      : await Alert.countDocuments(alertQuery);

    // High consumption state
    const isHighConsumption = peakConsumption > setting.highConsumptionThreshold || avgConsumption > 120;

    res.json({
      success: true,
      summary: {
        totalConsumption,
        avgConsumption,
        peakConsumption,
        totalCost,
        activeMetersCount,
        activeAlertsCount,
        consumptionChangePct: consumptionChangePct >= 0 ? `+${consumptionChangePct}%` : `${consumptionChangePct}%`,
        period,
        co2EmissionKg: Math.round(totalConsumption * 0.82),
        treesEquivalent: Math.round(totalConsumption * 0.04),
        powerFactor: 0.98,
        isHighConsumption,
        statusText: isHighConsumption ? 'High Consumption Alert' : 'Normal Consumption'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/analytics/trend
// @desc    Get consumption trend for Chart.js line charts
router.get('/trend', async (req, res) => {
  try {
    const { period = '30days', location } = req.query;
    const startDate = getDateRangeFilter(period);
    const locFilter = getRoleLocationFilter(req.user, location);

    const readings = await Reading.find({
      ...locFilter,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });

    const grouped = {};
    readings.forEach((r) => {
      const key = period === 'day'
        ? `${String(r.time || '').slice(0, 2).padStart(2, '0')}:00`
        : period === 'year'
        ? r.date.slice(0, 7)
        : r.date;
      if (!grouped[key]) grouped[key] = 0;
      grouped[key] += r.consumption;
    });

    const labels = Object.keys(grouped);
    const data = Object.values(grouped).map((val) => Math.round(val * 10) / 10);

    res.json({
      success: true,
      period,
      labels,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/analytics/location-wise
// @desc    Location comparison for bar chart
router.get('/location-wise', async (req, res) => {
  try {
    const locFilter = getRoleLocationFilter(req.user);
    const match = locFilter.location ? [{ $match: locFilter }] : [];

    const aggregation = await Reading.aggregate([
      ...match,
      {
        $group: {
          _id: '$location',
          totalConsumption: { $sum: '$consumption' },
          totalCost: { $sum: '$cost' },
          readingCount: { $sum: 1 }
        }
      },
      { $sort: { totalConsumption: -1 } }
    ]);

    const totalOverall = aggregation.reduce((acc, loc) => acc + loc.totalConsumption, 0);

    const result = aggregation.map((loc) => {
      const pct = totalOverall > 0 ? Math.round((loc.totalConsumption / totalOverall) * 1000) / 10 : 0;
      return {
        location: loc._id,
        consumption: Math.round(loc.totalConsumption),
        cost: Math.round(loc.totalCost),
        percentage: pct
      };
    });

    res.json({
      success: true,
      totalOverall: Math.round(totalOverall),
      locations: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/analytics/viewer-overview
// @desc    Simple, tailored overview for Viewer Dashboard (Section 6)
router.get('/viewer-overview', async (req, res) => {
  try {
    const assignedLocation = (req.user.assignedLocations && req.user.assignedLocations[0]) || 'Mumbai - BKC Distribution Hub';

    const setting = (await Setting.findOne()) || {
      highConsumptionThreshold: 150,
      electricityRate: 8.5
    };

    // 1. Latest recorded reading
    const latestReading = await Reading.findOne({ location: assignedLocation })
      .sort({ timestamp: -1 });

    // 2. Today's consumption
    const todayStr = new Date().toISOString().split('T')[0];
    const todayReadings = await Reading.find({
      location: assignedLocation,
      date: todayStr
    });
    const todayKWh = Math.round(todayReadings.reduce((sum, r) => sum + r.consumption, 0) * 10) / 10;

    // 3. Past 30 days consumption (Monthly)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthReadings = await Reading.find({
      location: assignedLocation,
      timestamp: { $gte: thirtyDaysAgo }
    });
    const monthlyKWh = Math.round(monthReadings.reduce((sum, r) => sum + r.consumption, 0));
    const monthlyCost = Math.round(monthlyKWh * (setting.electricityRate || 8.5));

    // 4. Trend for simple chart (past 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const trendReadings = await Reading.find({
      location: assignedLocation,
      timestamp: { $gte: sevenDaysAgo }
    }).sort({ timestamp: 1 });

    const dailyMap = {};
    trendReadings.forEach((r) => {
      dailyMap[r.date] = (dailyMap[r.date] || 0) + r.consumption;
    });

    const chartLabels = Object.keys(dailyMap);
    const chartData = Object.values(dailyMap).map((v) => Math.round(v * 10) / 10);

    // 5. Electricity Status: Normal or High
    const latestVal = latestReading ? latestReading.consumption : 0;
    const isHigh = latestVal > (setting.highConsumptionThreshold || 150) || (todayKWh > 200);
    const electricityStatus = isHigh ? 'High Consumption' : 'Normal';

    // 6. Assigned meters
    const meters = await Meter.find({ location: assignedLocation }).select('meterId type status currentReading');

    // 7. Viewer's open complaints
    const openComplaintsCount = await Complaint.countDocuments({
      viewerId: req.user._id,
      status: { $in: ['Pending', 'In Progress'] }
    });

    res.json({
      success: true,
      assignedLocation,
      electricityStatus,
      statusColor: isHigh ? 'danger' : 'success',
      threshold: setting.highConsumptionThreshold || 150,
      rate: setting.electricityRate || 8.5,
      latestReading: latestReading
        ? {
            consumption: latestReading.consumption,
            date: latestReading.date,
            time: latestReading.time,
            meterId: latestReading.meterId,
            cost: latestReading.cost,
            dataSource: latestReading.dataSource || 'Simulated'
          }
        : {
            consumption: 78.4,
            date: todayStr,
            time: '14:00',
            meterId: 'MTR-MUM-01',
            cost: 666.4,
            dataSource: 'Simulated'
          },
      todayKWh,
      monthlyKWh,
      monthlyCost,
      chart: {
        labels: chartLabels,
        data: chartData
      },
      meters,
      openComplaintsCount
    });
  } catch (error) {
    console.error('Error fetching viewer overview:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
