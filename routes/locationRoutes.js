const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const Meter = require('../models/Meter');
const Reading = require('../models/Reading');
const User = require('../models/User');
const { authorize } = require('../middleware/auth');

// @route   GET /api/locations
// @desc    Get locations based on role
router.get('/', async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'Viewer') {
      const viewerLocs = req.user.assignedLocations && req.user.assignedLocations.length > 0
        ? req.user.assignedLocations
        : ['Mumbai - BKC Distribution Hub'];
      query = { name: { $in: viewerLocs } };
    }

    const locations = await Location.find(query).sort({ name: 1 });

    const enrichedLocations = await Promise.all(
      locations.map(async (loc) => {
        const meters = await Meter.find({ location: loc.name });
        const meterCount = meters.length;

        const consumptionAggregation = await Reading.aggregate([
          { $match: { location: loc.name } },
          { $group: { _id: null, total: { $sum: '$consumption' } } }
        ]);

        const totalConsumption = consumptionAggregation.length > 0 ? Math.round(consumptionAggregation[0].total) : 0;

        const lastReading = await Reading.findOne({ location: loc.name })
          .sort({ timestamp: -1 });

        return {
          _id: loc._id,
          name: loc.name,
          city: loc.city || '',
          region: loc.region || '',
          address: loc.address,
          assignedManager: loc.assignedManager || 'Unassigned',
          assignedManagerId: loc.assignedManagerId,
          meterCount,
          status: loc.status,
          totalConsumption,
          lastReadingDate: lastReading ? `${lastReading.date} ${lastReading.time}` : 'No readings yet',
          createdAt: loc.createdAt
        };
      })
    );

    res.json({ success: true, count: enrichedLocations.length, locations: enrichedLocations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/locations (Admin only)
router.post('/', authorize('Admin'), async (req, res) => {
  try {
    const { name, city, region, address, assignedManagerId } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Location name is required' });
    }

    const existing = await Location.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A location with this name already exists' });
    }

    let managerName = 'Unassigned';
    if (assignedManagerId) {
      const manager = await User.findById(assignedManagerId);
      if (manager) {
        managerName = manager.name;
        if (!manager.assignedLocations.includes(name.trim())) {
          manager.assignedLocations.push(name.trim());
          await manager.save();
        }
      }
    }

    const newLoc = await Location.create({
      name: name.trim(),
      city: city ? city.trim() : '',
      region: region ? region.trim() : '',
      address: address ? address.trim() : 'Industrial & Commercial Facility',
      assignedManager: managerName,
      assignedManagerId: assignedManagerId || null,
      status: 'Active'
    });

    res.status(201).json({
      success: true,
      message: 'Location created successfully',
      location: newLoc
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/locations/:id (Admin only)
router.put('/:id', authorize('Admin'), async (req, res) => {
  try {
    const { name, city, region, address, status, assignedManagerId } = req.body;
    const location = await Location.findById(req.params.id);

    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    const oldName = location.name;

    if (name) location.name = name.trim();
    if (city !== undefined) location.city = city.trim();
    if (region !== undefined) location.region = region.trim();
    if (address !== undefined) location.address = address.trim();
    if (status) location.status = status;

    if (assignedManagerId !== undefined) {
      if (assignedManagerId) {
        const mgr = await User.findById(assignedManagerId);
        if (mgr && mgr.role === 'Manager') {
          location.assignedManager = mgr.name;
          location.assignedManagerId = mgr._id;
          if (!mgr.assignedLocations.includes(location.name)) {
            mgr.assignedLocations.push(location.name);
            await mgr.save();
          }
        }
      } else {
        location.assignedManager = 'Unassigned';
        location.assignedManagerId = null;
      }
    }

    await location.save();

    // If name changed, update meters & readings
    if (name && name.trim() !== oldName) {
      await Meter.updateMany({ location: oldName }, { $set: { location: name.trim() } });
      await Reading.updateMany({ location: oldName }, { $set: { location: name.trim() } });
    }

    res.json({
      success: true,
      message: 'Location updated successfully',
      location
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/locations/:id (Admin only)
router.delete('/:id', authorize('Admin'), async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    // Check if meters exist
    const meterCount = await Meter.countDocuments({ location: location.name });
    if (meterCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete location with ${meterCount} active meter(s). Remove meters first.`
      });
    }

    await location.deleteOne();
    res.json({ success: true, message: 'Location deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
