const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Location = require('../models/Location');
const { protect } = require('../middleware/auth');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'powerpulse_secret', {
    expiresIn: '7d'
  });
};

// @route   GET /api/auth/locations
// @desc    List available locations for the public Viewer registration form
router.get('/locations', async (req, res) => {
  try {
    const locations = await Location.find().select('name').sort({ name: 1 });
    res.json({ success: true, count: locations.length, locations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user with email, password, and expected role
router.post('/login', async (req, res) => {
  try {
    const { email, password, expectedRole } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    if (user.status === 'Deactivated') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated by the System Administrator.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Incorrect password.' });
    }

    // Role-specific login verification:
    if (expectedRole && user.role !== expectedRole) {
      let advice = 'Please use the appropriate portal login.';
      if (user.role === 'Admin') advice = 'Please log in via the Admin Portal at /admin-login.html';
      else if (user.role === 'Manager') advice = 'Please log in via the Manager Portal at /manager-login.html';
      else if (user.role === 'Viewer') advice = 'Please log in via the Viewer Portal at /viewer-login.html';

      return res.status(403).json({
        success: false,
        message: `Access denied. This account has the role '${user.role}', but this portal is reserved for '${expectedRole}'. ${advice}`
      });
    }

    const token = generateToken(user._id);

    // Map role to target dashboard
    let redirectUrl = '/viewer-dashboard.html';
    if (user.role === 'Admin') redirectUrl = '/admin-dashboard.html';
    else if (user.role === 'Manager') redirectUrl = '/manager-dashboard.html';

    res.json({
      success: true,
      token,
      redirectUrl,
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
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/register-viewer
// @desc    Self-registration for Viewers (allows creating any number of viewer IDs)
router.post('/register-viewer', async (req, res) => {
  try {
    const { name, email, password, location } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, Gmail/Email, and Password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email/Gmail already exists. Please log in.' });
    }

    // Viewer role is strictly enforced for self-registration
    const assignedLocation = location || 'Mumbai - BKC Distribution Hub';
    const locationExists = await Location.exists({ name: assignedLocation });
    if (!locationExists) {
      return res.status(400).json({ success: false, message: 'Please select an available location' });
    }

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      role: 'Viewer',
      assignedLocations: [assignedLocation],
      status: 'Active'
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Viewer account registered successfully!',
      token,
      redirectUrl: '/viewer-dashboard.html',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedLocations: user.assignedLocations
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get currently logged in user profile
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update basic user profile details (name)
router.put('/profile', protect, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Name cannot be empty' });
    }

    const user = await User.findById(req.user._id);
    user.name = name.trim();
    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedLocations: user.assignedLocations
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change password with current password verification
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password does not match' });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @route   GET /api/auth/demo-accounts
// @desc    Public helper endpoint to return demo credentials for testing
router.get('/demo-accounts', (req, res) => {
  res.json({
    success: true,
    accounts: [
      {
        role: 'Admin',
        note: 'Only ONE Admin account in the system',
        email: 'admin@powerpulse.io',
        password: 'admin123',
        description: 'Full master system control',
        portal: '/admin-login.html'
      },
      {
        role: 'Manager',
        note: 'Multiple Manager accounts supported (e.g. manager@powerpulse.io, manager@powerpulse1.io)',
        email: 'manager@powerpulse.io',
        password: 'manager123',
        description: 'Regional operations manager',
        portal: '/manager-login.html'
      },
      {
        role: 'Viewer',
        note: 'Unlimited Viewer accounts with any Gmail/email',
        email: 'viewer@powerpulse.io',
        password: 'viewer123',
        description: 'Facility consumer',
        portal: '/viewer-login.html'
      }
    ]
  });
});

module.exports = router;
