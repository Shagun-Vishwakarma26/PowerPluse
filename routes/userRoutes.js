const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authorize } = require('../middleware/auth');

// @route   GET /api/users/managers
router.get('/managers', authorize('Admin'), async (req, res) => {
  try {
    const managers = await User.find({ role: 'Manager', status: 'Active' })
      .select('name email role assignedLocations status')
      .sort({ name: 1 });
    res.json({ success: true, count: managers.length, managers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/users/viewers
router.get('/viewers', authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const viewers = await User.find({ role: 'Viewer' })
      .select('name email assignedLocations status')
      .sort({ name: 1 });
    res.json({ success: true, count: viewers.length, viewers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/users (Admin only)
router.get('/', authorize('Admin'), async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/users (Admin only)
// Enforces: Exactly ONE Admin ID, UNLIMITED Managers, and UNLIMITED Viewer IDs
router.post('/', authorize('Admin'), async (req, res) => {
  try {
    const { name, email, password, role, assignedLocations } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, Email, and Password are required' });
    }

    const assignedRole = role || 'Viewer';
    if (!['Admin', 'Manager', 'Viewer'].includes(assignedRole)) {
      return res.status(400).json({ success: false, message: 'Invalid user role' });
    }

    // Single Admin account restriction
    if (assignedRole === 'Admin') {
      const adminCount = await User.countDocuments({ role: 'Admin' });
      if (adminCount >= 1) {
        return res.status(400).json({
          success: false,
          message: 'System restriction: Only ONE Administrator ID is permitted in PowerPulse.'
        });
      }
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const locationsArray = Array.isArray(assignedLocations)
      ? assignedLocations
      : assignedLocations
      ? [assignedLocations]
      : ['Mumbai - BKC Distribution Hub'];

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      role: assignedRole,
      assignedLocations: locationsArray,
      status: 'Active'
    });

    res.status(201).json({
      success: true,
      message: `${assignedRole} account created successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedLocations: user.assignedLocations,
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/users/:id (Admin only)
router.put('/:id', authorize('Admin'), async (req, res) => {
  try {
    const { name, email, password, role, assignedLocations, status } = req.body;

    let user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (role && !['Admin', 'Manager', 'Viewer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid user role' });
    }

    // Role count restrictions
    if (role === 'Admin' && user.role !== 'Admin') {
      const adminCount = await User.countDocuments({ role: 'Admin' });
      if (adminCount >= 1) {
        return res.status(400).json({ success: false, message: 'Only ONE Admin account is permitted in the system.' });
      }
    }

    if (user.role === 'Admin' && role && role !== 'Admin') {
      const adminCount = await User.countDocuments({ role: 'Admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot demote the only System Admin account' });
      }
    }

    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (role) user.role = role;
    if (status) user.status = status;

    if (assignedLocations !== undefined) {
      user.assignedLocations = Array.isArray(assignedLocations)
        ? assignedLocations
        : [assignedLocations];
    }

    if (password && password.trim().length > 0) {
      user.password = password;
    }

    await user.save();

    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedLocations: user.assignedLocations,
        status: user.status
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/users/:id/toggle-status (Admin only)
router.put('/:id/toggle-status', authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'Admin') {
      return res.status(400).json({ success: false, message: 'Cannot deactivate the single System Admin account' });
    }

    user.status = user.status === 'Active' ? 'Deactivated' : 'Active';
    await user.save();

    res.json({
      success: true,
      message: `User account is now ${user.status}`,
      status: user.status
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/users/:id (Admin only)
router.delete('/:id', authorize('Admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'Admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete the only System Admin account' });
    }

    await user.deleteOne();
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
