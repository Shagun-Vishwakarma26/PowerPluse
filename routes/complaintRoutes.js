const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// Helper to generate unique complaint ID
const generateComplaintId = async () => {
  const count = await Complaint.countDocuments();
  const nextNum = 1001 + count;
  return `CMP-${nextNum}`;
};

// @route   POST /api/complaints
// @desc    Submit a new complaint (Primary: Viewer)
router.post('/', protect, async (req, res) => {
  try {
    const { title, category, description, location, meterId, priority } = req.body;

    if (!title || !category || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title, Category, and Description are required'
      });
    }

    // Default location to Viewer's first assigned location or default
    let complaintLocation = location;
    if (!complaintLocation) {
      if (req.user.assignedLocations && req.user.assignedLocations.length > 0) {
        complaintLocation = req.user.assignedLocations[0];
      } else {
        complaintLocation = 'Mumbai - BKC Distribution Hub';
      }
    }

    const complaintId = await generateComplaintId();

    // Find any manager assigned to this location for auto-assignment or notification
    const assignedManager = await User.findOne({
      role: 'Manager',
      assignedLocations: complaintLocation
    });

    const complaint = await Complaint.create({
      complaintId,
      title: title.trim(),
      category,
      description: description.trim(),
      viewerId: req.user._id,
      viewerName: req.user.name,
      viewerEmail: req.user.email,
      assignedManagerId: assignedManager ? assignedManager._id : null,
      assignedManagerName: assignedManager ? assignedManager.name : 'Unassigned',
      location: complaintLocation,
      meterId: meterId || 'MTR-MUM-01',
      priority: priority || 'Medium',
      status: 'Pending',
      activityLog: [
        {
          action: 'Complaint Created',
          performedBy: req.user.name,
          role: req.user.role,
          details: `Complaint submitted under category "${category}"`,
          timestamp: new Date()
        }
      ]
    });

    // Create notifications for Admins
    const admins = await User.find({ role: 'Admin' });
    for (const admin of admins) {
      await Notification.create({
        recipient: admin._id,
        type: 'NEW_COMPLAINT',
        title: `New Complaint: ${complaintId}`,
        message: `${req.user.name} reported a problem: "${title}" at ${complaintLocation}`,
        relatedId: complaint._id.toString()
      });
    }

    // If a manager is associated with the location, notify them too
    if (assignedManager) {
      await Notification.create({
        recipient: assignedManager._id,
        type: 'NEW_COMPLAINT',
        title: `New Complaint in Assigned Location: ${complaintId}`,
        message: `A new problem was reported at ${complaintLocation}: "${title}"`,
        relatedId: complaint._id.toString()
      });
    }

    res.status(201).json({
      success: true,
      message: `Complaint ${complaintId} submitted successfully. An authorized manager has been alerted.`,
      complaint
    });
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/complaints
// @desc    Viewers see their complaints; Managers and Admins can see all complaints
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    const { status, priority, category, location, search } = req.query;

    if (req.user.role === 'Viewer') {
      // STRICT ISOLATION: Viewers can only view their own complaints
      query.viewerId = req.user._id;
    }

    if (status && status !== 'all') {
      query.status = status;
    }
    if (priority && priority !== 'all') {
      query.priority = priority;
    }
    if (category && category !== 'all') {
      query.category = category;
    }
    if (location && location !== 'all') {
      query.location = location;
    }
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { complaintId: searchRegex },
          { title: searchRegex },
          { description: searchRegex },
          { viewerName: searchRegex }
        ]
      });
    }

    const complaints = await Complaint.find(query).sort({ createdAt: -1 });

    // Compute status counts for dashboard badges
    const total = complaints.length;
    const pendingCount = complaints.filter((c) => c.status === 'Pending').length;
    const inProgressCount = complaints.filter((c) => c.status === 'In Progress').length;
    const resolvedCount = complaints.filter((c) => c.status === 'Resolved').length;
    const rejectedCount = complaints.filter((c) => c.status === 'Rejected').length;

    res.json({
      success: true,
      count: total,
      counts: {
        total,
        pending: pendingCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        rejected: rejectedCount
      },
      complaints
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/complaints/:id
// @desc    Get complaint detail with messages & logs
router.get('/:id', protect, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Role-based authorization check
    if (req.user.role === 'Viewer') {
      if (complaint.viewerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied. You can only view your own complaints.' });
      }
    }

    res.json({ success: true, complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/complaints/:id/status
// @desc    Update complaint status, manager response, or resolution details
router.put('/:id/status', protect, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const { status, managerResponse, resolutionDetails } = req.body;
    const validStatuses = ['Pending', 'In Progress', 'Resolved', 'Rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const previousStatus = complaint.status;
    complaint.status = status;

    if (managerResponse) complaint.managerResponse = managerResponse;
    if (resolutionDetails) complaint.resolutionDetails = resolutionDetails;

    if (status === 'Resolved') {
      complaint.resolvedAt = new Date();
    }

    // Append to activity log
    complaint.activityLog.push({
      action: `Status changed from ${previousStatus} to ${status}`,
      performedBy: req.user.name,
      role: req.user.role,
      details: resolutionDetails || managerResponse || `Status updated by ${req.user.role}`,
      timestamp: new Date()
    });

    await complaint.save();

    const solution = resolutionDetails || managerResponse;

    // Create Notification for the Viewer
    await Notification.create({
      recipient: complaint.viewerId,
      type: status === 'Resolved' ? 'COMPLAINT_RESOLVED' : 'STATUS_CHANGE',
      title: status === 'Resolved' ? `Complaint ${complaint.complaintId} Resolved` : `Complaint Status: ${status}`,
      message: `${req.user.name} (${req.user.role}) updated your complaint "${complaint.title}" to ${status}.${status === 'Resolved' && solution ? ' Solution: ' + solution : ''}`,
      relatedId: complaint._id.toString()
    });

    res.json({
      success: true,
      message: `Complaint ${complaint.complaintId} updated to ${status}`,
      complaint
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/complaints/:id/assign
// @desc    Assign or reassign complaint to Manager (Admin only)
router.put('/:id/assign', protect, authorize('Admin'), async (req, res) => {
  try {
    const { managerId, priority } = req.body;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    let managerName = 'Unassigned';
    if (managerId) {
      const manager = await User.findById(managerId);
      if (!manager || manager.role !== 'Manager') {
        return res.status(400).json({ success: false, message: 'Selected user is not an active Manager' });
      }
      complaint.assignedManagerId = manager._id;
      complaint.assignedManagerName = manager.name;
      managerName = manager.name;

      // Notify the manager
      await Notification.create({
        recipient: manager._id,
        type: 'COMPLAINT_ASSIGNED',
        title: `Complaint Assigned: ${complaint.complaintId}`,
        message: `Admin assigned you complaint "${complaint.title}" at ${complaint.location}. Priority: ${priority || complaint.priority}`,
        relatedId: complaint._id.toString()
      });
    }

    if (priority) {
      complaint.priority = priority;
    }

    complaint.activityLog.push({
      action: `Assigned to ${managerName}`,
      performedBy: req.user.name,
      role: 'Admin',
      details: priority ? `Priority set to ${priority}` : '',
      timestamp: new Date()
    });

    await complaint.save();

    // Notify viewer
    await Notification.create({
      recipient: complaint.viewerId,
      type: 'COMPLAINT_ASSIGNED',
      title: `Complaint ${complaint.complaintId} Assigned`,
      message: `Your complaint has been assigned to Manager ${managerName} for resolution.`,
      relatedId: complaint._id.toString()
    });

    res.json({
      success: true,
      message: `Complaint assigned to ${managerName} successfully`,
      complaint
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/complaints/:id/reopen
// @desc    Reopen a resolved or rejected complaint (Admin only)
router.put('/:id/reopen', protect, authorize('Admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    complaint.status = 'In Progress';
    complaint.resolvedAt = null;

    complaint.activityLog.push({
      action: 'Complaint Reopened',
      performedBy: req.user.name,
      role: 'Admin',
      details: reason || 'Reopened by Admin for further investigation',
      timestamp: new Date()
    });

    await complaint.save();

    // Notify Viewer
    await Notification.create({
      recipient: complaint.viewerId,
      type: 'STATUS_CHANGE',
      title: `Complaint ${complaint.complaintId} Reopened`,
      message: `Admin reopened your complaint for further investigation.${reason ? ' Reason: ' + reason : ''}`,
      relatedId: complaint._id.toString()
    });

    // Notify assigned manager if any
    if (complaint.assignedManagerId) {
      await Notification.create({
        recipient: complaint.assignedManagerId,
        type: 'STATUS_CHANGE',
        title: `Complaint ${complaint.complaintId} Reopened`,
        message: `Admin reopened complaint "${complaint.title}" for your location.`,
        relatedId: complaint._id.toString()
      });
    }

    res.json({
      success: true,
      message: `Complaint ${complaint.complaintId} reopened successfully`,
      complaint
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/complaints/:id/messages
// @desc    Add a message / follow-up communication to a complaint
router.post('/:id/messages', protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Role-based check
    if (req.user.role === 'Viewer') {
      if (complaint.viewerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const newMessage = {
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      message: message.trim(),
      createdAt: new Date()
    };

    complaint.messages.push(newMessage);

    // If Manager replies, update managerResponse field as well
    if (req.user.role === 'Manager' || req.user.role === 'Admin') {
      complaint.managerResponse = message.trim();
    }

    complaint.activityLog.push({
      action: `Message from ${req.user.role} (${req.user.name})`,
      performedBy: req.user.name,
      role: req.user.role,
      details: message.trim().substring(0, 100),
      timestamp: new Date()
    });

    await complaint.save();

    // Send notifications to appropriate recipient
    if (req.user.role === 'Viewer') {
      // Notify assigned manager or admins
      if (complaint.assignedManagerId) {
        await Notification.create({
          recipient: complaint.assignedManagerId,
          type: 'MANAGER_RESPONSE',
          title: `Follow-up on ${complaint.complaintId}`,
          message: `${req.user.name} sent a follow-up message: "${message.trim()}"`,
          relatedId: complaint._id.toString()
        });
      }
    } else {
      // Manager or Admin replied, notify the Viewer!
      await Notification.create({
        recipient: complaint.viewerId,
        type: 'MANAGER_RESPONSE',
        title: `Response on ${complaint.complaintId}`,
        message: `${req.user.name} (${req.user.role}) sent a message: "${message.trim()}"`,
        relatedId: complaint._id.toString()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      complaint
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
