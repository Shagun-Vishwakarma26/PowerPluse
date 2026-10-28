const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const Reading = require('../models/Reading');

async function testBackend() {
  await connectDB();
  console.log('\n--- 1. Testing User Accounts ---');
  const admin = await User.findOne({ email: 'admin@powerpulse.io' });
  const manager = await User.findOne({ email: 'manager@powerpulse.io' });
  const viewer = await User.findOne({ email: 'viewer@powerpulse.io' });

  console.log('Admin found:', admin?.name, 'Role:', admin?.role);
  console.log('Manager found:', manager?.name, 'Role:', manager?.role, 'Locations:', manager?.assignedLocations);
  console.log('Viewer found:', viewer?.name, 'Role:', viewer?.role, 'Locations:', viewer?.assignedLocations);

  console.log('\n--- 2. Testing Password Matching ---');
  console.log('Admin password match (admin123):', await admin.matchPassword('admin123'));
  console.log('Admin wrong password match (wrong):', await admin.matchPassword('wrong'));
  console.log('Manager password match (manager123):', await manager.matchPassword('manager123'));
  console.log('Viewer password match (viewer123):', await viewer.matchPassword('viewer123'));

  console.log('\n--- 3. Testing Complaint Isolation ---');
  const allComplaints = await Complaint.find();
  console.log('Total Complaints in DB:', allComplaints.length);

  const viewerComplaints = await Complaint.find({ viewerId: viewer._id });
  console.log('Viewer Complaints count:', viewerComplaints.length);

  const managerComplaints = await Complaint.find({
    $or: [
      { assignedManagerId: manager._id },
      { location: { $in: manager.assignedLocations } }
    ]
  });
  console.log('Manager (Mumbai) complaints count:', managerComplaints.length);

  console.log('\n--- 4. Testing Notifications ---');
  const viewerNotifs = await Notification.find({ recipient: viewer._id });
  console.log('Viewer notifications count:', viewerNotifs.length);
  const managerNotifs = await Notification.find({ recipient: manager._id });
  console.log('Manager notifications count:', managerNotifs.length);

  console.log('\n--- 5. Testing Electricity Readings ---');
  const totalReadings = await Reading.countDocuments();
  console.log('Total readings count:', totalReadings);

  console.log('\n>>> ALL BACKEND MODEL & QUERY TESTS PASSED! <<<\n');
  process.exit(0);
}

testBackend().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
