const User = require('../models/User');
const Location = require('../models/Location');
const Meter = require('../models/Meter');
const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const Setting = require('../models/Setting');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');

const seedDatabase = async () => {
  try {
    console.log('⚡ Initializing PowerPulse database seed with Indian Locations...');

    if (process.env.NODE_ENV === 'production') {
      const existingCounts = await Promise.all([
        User.countDocuments(),
        Location.countDocuments(),
        Meter.countDocuments(),
        Reading.countDocuments(),
        Alert.countDocuments(),
        Setting.countDocuments(),
        Complaint.countDocuments(),
        Notification.countDocuments()
      ]);

      if (existingCounts.some((count) => count > 0)) {
        console.log('Production database contains data; skipping destructive seed.');
        return;
      }
    }

    const seedCredentials = process.env.NODE_ENV === 'production'
      ? {
          admin: { email: process.env.INITIAL_ADMIN_EMAIL, password: process.env.INITIAL_ADMIN_PASSWORD },
          manager: { email: process.env.INITIAL_MANAGER_EMAIL, password: process.env.INITIAL_MANAGER_PASSWORD },
          viewer: { email: process.env.INITIAL_VIEWER_EMAIL, password: process.env.INITIAL_VIEWER_PASSWORD }
        }
      : {
          admin: { email: 'admin@powerpulse.io', password: 'admin123' },
          manager: { email: 'manager@powerpulse.io', password: 'manager123' },
          viewer: { email: 'viewer@powerpulse.io', password: 'viewer123' }
        };

    if (Object.values(seedCredentials).some(({ email, password }) => !email || !password)) {
      throw new Error('Production initial account email and password environment variables are required.');
    }

    // Clear existing collections
    await Promise.all([
      User.deleteMany({}),
      Location.deleteMany({}),
      Meter.deleteMany({}),
      Reading.deleteMany({}),
      Alert.deleteMany({}),
      Setting.deleteMany({}),
      Complaint.deleteMany({}),
      Notification.deleteMany({})
    ]);

    // 1. Seed System Settings (Currency in ₹ INR)
    await Setting.create({
      systemName: 'PowerPulse – Smart Electricity Monitoring System',
      defaultLocation: 'Mumbai - BKC Distribution Hub',
      currency: '₹',
      timeZone: 'Asia/Kolkata',
      highConsumptionThreshold: 150,
      criticalConsumptionThreshold: 200,
      electricityRate: 8.5,
      enableAlerts: true,
      enableHighAlerts: true,
      enableCriticalAlerts: true,
      theme: 'dark',
      density: 'comfortable'
    });

    // 2. Exactly ONE System Administrator
    const admin = await User.create({
      name: 'Chief Administrator (Admin)',
      email: seedCredentials.admin.email,
      password: seedCredentials.admin.password,
      role: 'Admin',
      assignedLocations: [
        'Mumbai - BKC Distribution Hub',
        'Mumbai - Andheri Industrial Hub',
        'Navi Mumbai - Airoli Technology Park',
        'Navi Mumbai - Vashi Distribution Hub',
        'Palghar - Boisar Industrial Estate',
        'Thane - Wagle Estate Grid',
        'Nashik - Ambad Industrial Substation',
        'Nagpur - MIHAN Distribution Hub',
        'Delhi - Connaught Place Substation',
        'Bengaluru - Electronic City Tech Grid',
        'Pune - Hinjewadi Infotech Substation',
        'Hyderabad - HITEC City Cyber Grid',
        'Chennai - Tidel Park Substation',
        'Kolkata - Salt Lake Sector V'
      ],
      status: 'Active'
    });

    // Seed a default Manager; the system supports multiple Managers.
    const manager = await User.create({
      name: 'Regional Operations Manager',
      email: seedCredentials.manager.email,
      password: seedCredentials.manager.password,
      role: 'Manager',
      assignedLocations: [
        'Mumbai - BKC Distribution Hub',
        'Mumbai - Andheri Industrial Hub',
        'Navi Mumbai - Airoli Technology Park',
        'Navi Mumbai - Vashi Distribution Hub',
        'Palghar - Boisar Industrial Estate',
        'Thane - Wagle Estate Grid',
        'Nashik - Ambad Industrial Substation',
        'Nagpur - MIHAN Distribution Hub',
        'Delhi - Connaught Place Substation',
        'Bengaluru - Electronic City Tech Grid',
        'Pune - Hinjewadi Infotech Substation',
        'Hyderabad - HITEC City Cyber Grid',
        'Chennai - Tidel Park Substation',
        'Kolkata - Salt Lake Sector V',
        'Ahmedabad - Sanand Industrial Grid',
        'Jaipur - Sitapura Industrial Hub',
        'Lucknow - Amausi Industrial Substation',
        'Kochi - Infopark Distribution Hub'
      ],
      status: 'Active'
    });

    // Pre-seeded Default Viewer (Consumers can also register with their own Gmail!)
    const viewer1 = await User.create({
      name: 'Facility Consumer',
      email: seedCredentials.viewer.email,
      password: seedCredentials.viewer.password,
      role: 'Viewer',
      assignedLocations: ['Mumbai - BKC Distribution Hub'],
      status: 'Active'
    });

    // 3. Prominent Regional Locations in India
    const locations = [
      {
        name: 'Mumbai - BKC Distribution Hub',
        city: 'Mumbai',
        region: 'Bandra Kurla Complex (BKC)',
        address: 'G-Block Commercial Substation, BKC, Mumbai 400051',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        meterCount: 2,
        status: 'Active'
      },
      {
        name: 'Mumbai - Andheri Industrial Hub',
        city: 'Mumbai',
        region: 'Andheri East',
        address: 'Andheri East Industrial Estate, Mumbai 400069',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        status: 'Active'
      },
      {
        name: 'Navi Mumbai - Airoli Technology Park',
        city: 'Navi Mumbai',
        region: 'Airoli',
        address: 'Airoli Knowledge Park, Navi Mumbai 400708',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        status: 'Active'
      },
      {
        name: 'Navi Mumbai - Vashi Distribution Hub',
        city: 'Navi Mumbai',
        region: 'Vashi',
        address: 'Vashi Industrial and Commercial Area, Navi Mumbai 400703',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        status: 'Active'
      },
      {
        name: 'Palghar - Boisar Industrial Estate',
        city: 'Palghar',
        region: 'Boisar',
        address: 'Tarapur MIDC, Boisar, Palghar 401506',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        status: 'Active'
      },
      {
        name: 'Thane - Wagle Estate Grid',
        city: 'Thane',
        region: 'Wagle Estate',
        address: 'Wagle Industrial Estate, Thane 400604',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        status: 'Active'
      },
      {
        name: 'Nashik - Ambad Industrial Substation',
        city: 'Nashik',
        region: 'Ambad',
        address: 'Ambad MIDC, Nashik 422010',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        status: 'Active'
      },
      {
        name: 'Nagpur - MIHAN Distribution Hub',
        city: 'Nagpur',
        region: 'MIHAN',
        address: 'MIHAN SEZ, Nagpur 441108',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        status: 'Active'
      },
      {
        name: 'Delhi - Connaught Place Substation',
        city: 'Delhi',
        region: 'Central Delhi',
        address: 'NDMC Inner Circle Power Transformer, New Delhi 110001',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        meterCount: 2,
        status: 'Active'
      },
      {
        name: 'Bengaluru - Electronic City Tech Grid',
        city: 'Bengaluru',
        region: 'Electronic City Phase 1',
        address: 'Hosur Road Industrial Substation, Bengaluru 560100',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        meterCount: 2,
        status: 'Active'
      },
      {
        name: 'Pune - Hinjewadi Infotech Substation',
        city: 'Pune',
        region: 'Hinjewadi Phase 1',
        address: 'Rajiv Gandhi Infotech Park Grid, Pune 411057',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        meterCount: 2,
        status: 'Warning'
      },
      {
        name: 'Hyderabad - HITEC City Cyber Grid',
        city: 'Hyderabad',
        region: 'Madhapur',
        address: 'Cyber Towers Substation, HITEC City, Hyderabad 500081',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        meterCount: 1,
        status: 'Active'
      },
      {
        name: 'Chennai - Tidel Park Substation',
        city: 'Chennai',
        region: 'Taramani',
        address: 'Rajiv Gandhi Salai OMR Substation, Chennai 600113',
        assignedManager: 'Unassigned',
        assignedManagerId: null,
        meterCount: 1,
        status: 'Active'
      },
      {
        name: 'Kolkata - Salt Lake Sector V',
        city: 'Kolkata',
        region: 'Bidhannagar',
        address: 'Sector V IT Cluster Substation, Kolkata 700091',
        assignedManager: 'Unassigned',
        assignedManagerId: null,
        meterCount: 1,
        status: 'Active'
      },
      {
        name: 'Ahmedabad - Sanand Industrial Grid',
        city: 'Ahmedabad',
        region: 'Sanand',
        address: 'Sanand Industrial Estate, Ahmedabad 382110',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        status: 'Active'
      },
      {
        name: 'Jaipur - Sitapura Industrial Hub',
        city: 'Jaipur',
        region: 'Sitapura',
        address: 'Sitapura Industrial Area, Jaipur 302022',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        status: 'Active'
      },
      {
        name: 'Lucknow - Amausi Industrial Substation',
        city: 'Lucknow',
        region: 'Amausi',
        address: 'Amausi Industrial Area, Lucknow 226008',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        status: 'Active'
      },
      {
        name: 'Kochi - Infopark Distribution Hub',
        city: 'Kochi',
        region: 'Kakkanad',
        address: 'Infopark, Kakkanad, Kochi 682042',
        assignedManager: manager.name,
        assignedManagerId: manager._id,
        status: 'Active'
      }
    ];

    await Location.insertMany(locations);

    // 4. Seed Meters in Indian Locations
    const meters = [
      {
        meterId: 'MTR-MUM-01',
        location: 'Mumbai - BKC Distribution Hub',
        type: 'Smart Meter',
        currentReading: 84.5,
        status: 'Active',
        ownerId: viewer1._id
      },
      {
        meterId: 'MTR-MUM-02',
        location: 'Mumbai - BKC Distribution Hub',
        type: 'Smart Meter',
        currentReading: 66.0,
        status: 'Active'
      },
      {
        meterId: 'MTR-DEL-01',
        location: 'Delhi - Connaught Place Substation',
        type: 'Smart Meter',
        currentReading: 94.2,
        status: 'Active'
      },
      {
        meterId: 'MTR-DEL-02',
        location: 'Delhi - Connaught Place Substation',
        type: 'Manual Meter',
        currentReading: 48.0,
        status: 'Active'
      },
      {
        meterId: 'MTR-BLR-01',
        location: 'Bengaluru - Electronic City Tech Grid',
        type: 'Smart Meter',
        currentReading: 112.5,
        status: 'Active'
      },
      {
        meterId: 'MTR-BLR-02',
        location: 'Bengaluru - Electronic City Tech Grid',
        type: 'Smart Meter',
        currentReading: 88.0,
        status: 'Active'
      },
      {
        meterId: 'MTR-PNE-01',
        location: 'Pune - Hinjewadi Infotech Substation',
        type: 'Smart Meter',
        currentReading: 178.6,
        status: 'Warning'
      },
      {
        meterId: 'MTR-PNE-02',
        location: 'Pune - Hinjewadi Infotech Substation',
        type: 'Smart Meter',
        currentReading: 105.4,
        status: 'Active'
      },
      {
        meterId: 'MTR-HYD-01',
        location: 'Hyderabad - HITEC City Cyber Grid',
        type: 'Smart Meter',
        currentReading: 72.1,
        status: 'Active'
      },
      {
        meterId: 'MTR-CHE-01',
        location: 'Chennai - Tidel Park Substation',
        type: 'Smart Meter',
        currentReading: 65.4,
        status: 'Active'
      },
      {
        meterId: 'MTR-KOL-01',
        location: 'Kolkata - Salt Lake Sector V',
        type: 'Smart Meter',
        currentReading: 58.0,
        status: 'Active'
      },
      {
        meterId: 'MTR-MUM-03',
        location: 'Mumbai - Andheri Industrial Hub',
        type: 'Smart Meter',
        currentReading: 76.3,
        status: 'Active'
      },
      {
        meterId: 'MTR-NVM-01',
        location: 'Navi Mumbai - Airoli Technology Park',
        type: 'Smart Meter',
        currentReading: 82.7,
        status: 'Active'
      },
      {
        meterId: 'MTR-NVM-02',
        location: 'Navi Mumbai - Vashi Distribution Hub',
        type: 'Smart Meter',
        currentReading: 69.2,
        status: 'Active'
      },
      {
        meterId: 'MTR-PLG-01',
        location: 'Palghar - Boisar Industrial Estate',
        type: 'Smart Meter',
        currentReading: 91.4,
        status: 'Active'
      },
      {
        meterId: 'MTR-THN-01',
        location: 'Thane - Wagle Estate Grid',
        type: 'Smart Meter',
        currentReading: 73.8,
        status: 'Active'
      },
      {
        meterId: 'MTR-NSK-01',
        location: 'Nashik - Ambad Industrial Substation',
        type: 'Smart Meter',
        currentReading: 64.9,
        status: 'Active'
      },
      {
        meterId: 'MTR-NGP-01',
        location: 'Nagpur - MIHAN Distribution Hub',
        type: 'Smart Meter',
        currentReading: 87.1,
        status: 'Active'
      },
      {
        meterId: 'MTR-AMD-01',
        location: 'Ahmedabad - Sanand Industrial Grid',
        type: 'Smart Meter',
        currentReading: 78.6,
        status: 'Active'
      },
      {
        meterId: 'MTR-JPR-01',
        location: 'Jaipur - Sitapura Industrial Hub',
        type: 'Smart Meter',
        currentReading: 62.5,
        status: 'Active'
      },
      {
        meterId: 'MTR-LKO-01',
        location: 'Lucknow - Amausi Industrial Substation',
        type: 'Smart Meter',
        currentReading: 71.8,
        status: 'Active'
      },
      {
        meterId: 'MTR-KOC-01',
        location: 'Kochi - Infopark Distribution Hub',
        type: 'Smart Meter',
        currentReading: 59.7,
        status: 'Active'
      }
    ];

    await Meter.insertMany(meters);

    // 5. Seed 30-day realistic electricity readings in kWh
    const readings = [];
    const now = new Date();
    const rate = 8.5;

    const locationProfiles = {
      'Mumbai - BKC Distribution Hub': { base: 65, peak: 140, meter: 'MTR-MUM-01', owner: viewer1._id },
      'Delhi - Connaught Place Substation': { base: 70, peak: 145, meter: 'MTR-DEL-01', owner: null },
      'Bengaluru - Electronic City Tech Grid': { base: 60, peak: 135, meter: 'MTR-BLR-01', owner: null },
      'Pune - Hinjewadi Infotech Substation': { base: 85, peak: 195, meter: 'MTR-PNE-01', owner: null },
      'Hyderabad - HITEC City Cyber Grid': { base: 55, peak: 120, meter: 'MTR-HYD-01', owner: null },
      'Chennai - Tidel Park Substation': { base: 50, peak: 115, meter: 'MTR-CHE-01', owner: null },
      'Kolkata - Salt Lake Sector V': { base: 45, peak: 95, meter: 'MTR-KOL-01', owner: null }
    };

    const timeSlots = [
      { hour: '03:00', factor: 0.35 },
      { hour: '08:00', factor: 0.95 },
      { hour: '13:00', factor: 1.65 },
      { hour: '18:00', factor: 1.25 },
      { hour: '22:00', factor: 0.70 }
    ];

    for (let day = 30; day >= 0; day--) {
      const dateObj = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
      const dateStr = dateObj.toISOString().split('T')[0];

      for (const [locName, profile] of Object.entries(locationProfiles)) {
        for (const slot of timeSlots) {
          const timestamp = new Date(`${dateStr}T${slot.hour}:00.000Z`);
          let kWh = profile.base + (profile.peak - profile.base) * slot.factor;

          if (locName === 'Pune - Hinjewadi Infotech Substation' && day === 1 && slot.hour === '13:00') {
            kWh = 245.5; // High critical spike in Pune
          } else if (locName === 'Mumbai - BKC Distribution Hub' && day === 3 && slot.hour === '13:00') {
            kWh = 188.0; // High consumption spike in Mumbai BKC
          } else {
            kWh = Math.round((kWh + (Math.random() * 8 - 4)) * 10) / 10;
          }

          const cost = Math.round(kWh * rate * 100) / 100;

          readings.push({
            location: locName,
            meterId: profile.meter,
            ownerId: profile.owner,
            date: dateStr,
            time: slot.hour,
            timestamp,
            consumption: kWh,
            cost,
            readingType: 'Smart Meter',
            dataSource: 'Simulated',
            notes:
              day === 1 && locName.includes('Pune')
                ? 'High industrial surge detected in Hinjewadi cluster'
                : 'Automated simulated grid telemetry'
          });
        }
      }
    }

    await Reading.insertMany(readings);

    // 6. Seed High Consumption Alerts
    const alerts = [
      {
        type: 'Critical Consumption',
        severity: 'Critical',
        location: 'Pune - Hinjewadi Infotech Substation',
        meterId: 'MTR-PNE-01',
        message: 'Critical load spike! 245.5 kWh recorded at 13:00 in Hinjewadi Phase 1, exceeding 200 kWh threshold.',
        consumption: 245.5,
        threshold: 200,
        status: 'New',
        createdAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000 + 13 * 3600 * 1000)
      },
      {
        type: 'High Consumption',
        severity: 'High',
        location: 'Mumbai - BKC Distribution Hub',
        meterId: 'MTR-MUM-01',
        message: 'Elevated electricity consumption: 188.0 kWh recorded at BKC Substation (exceeds 150 kWh baseline).',
        consumption: 188.0,
        threshold: 150,
        status: 'Acknowledged',
        createdAt: new Date(now.getTime() - 3 * 24 * 3600 * 1000 + 13 * 3600 * 1000)
      },
      {
        type: 'Sudden Increase',
        severity: 'Medium',
        location: 'Delhi - Connaught Place Substation',
        meterId: 'MTR-DEL-01',
        message: 'Sudden 34% increase in Connaught Place commercial district relative to 7-day baseline.',
        consumption: 135.2,
        threshold: 95,
        status: 'New',
        createdAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000 + 18 * 3600 * 1000)
      }
    ];

    await Alert.insertMany(alerts);

    // 7. Seed Complaints in Indian Facilities
    const resolvedComplaint = await Complaint.create({
      complaintId: 'CMP-1001',
      title: 'Discrepancy in Phase 2 BKC Sub-meter 01',
      category: 'Incorrect electricity reading',
      description: 'The reading spiked by 300% on Monday between 02:00 AM and 04:00 AM when our unit was completely shut down.',
      viewerId: viewer1._id,
      viewerName: viewer1.name,
      viewerEmail: viewer1.email,
      assignedManagerId: manager._id,
      assignedManagerName: manager.name,
      location: 'Mumbai - BKC Distribution Hub',
      meterId: 'MTR-MUM-01',
      priority: 'High',
      status: 'Resolved',
      managerResponse: 'Technician dispatched. CT sensor calibrated and zero-drift offset rectified.',
      resolutionDetails: 'Field technician inspected meter MTR-MUM-01. Sensor CT-02 had an impedance calibration drift. Sensor replaced and zero baseline re-verified. 45.2 kWh billing adjustment credited.',
      resolvedAt: new Date(now.getTime() - 24 * 3600 * 1000),
      createdAt: new Date(now.getTime() - 4 * 24 * 3600 * 1000),
      messages: [
        {
          senderId: viewer1._id,
          senderName: viewer1.name,
          senderRole: 'Viewer',
          message: 'Can someone please inspect meter MTR-MUM-01 at BKC? The night spike does not match our power log.',
          createdAt: new Date(now.getTime() - 4 * 24 * 3600 * 1000)
        },
        {
          senderId: manager._id,
          senderName: manager.name,
          senderRole: 'Manager',
          message: 'Hello, I have scheduled our electrical engineer to inspect the telemetry bridge tomorrow at 10 AM.',
          createdAt: new Date(now.getTime() - 3 * 24 * 3600 * 1000)
        },
        {
          senderId: manager._id,
          senderName: manager.name,
          senderRole: 'Manager',
          message: 'The inspection is complete! The CT sensor has been replaced and verified. The complaint is now resolved.',
          createdAt: new Date(now.getTime() - 24 * 3600 * 1000)
        }
      ],
      activityLog: [
        {
          action: 'Complaint Created',
          performedBy: viewer1.name,
          role: 'Viewer',
          details: 'Submitted with High priority',
          timestamp: new Date(now.getTime() - 4 * 24 * 3600 * 1000)
        },
        {
          action: 'Assigned to Regional Operations Manager',
          performedBy: admin.name,
          role: 'Admin',
          details: 'Assigned to manager for Mumbai region',
          timestamp: new Date(now.getTime() - 4 * 24 * 3600 * 1000)
        },
        {
          action: 'Status changed from Pending to In Progress',
          performedBy: manager.name,
          role: 'Manager',
          details: 'Engineer dispatched for site inspection',
          timestamp: new Date(now.getTime() - 3 * 24 * 3600 * 1000)
        },
        {
          action: 'Status changed from In Progress to Resolved',
          performedBy: manager.name,
          role: 'Manager',
          details: 'Sensor replaced and verified. Credit voucher issued.',
          timestamp: new Date(now.getTime() - 24 * 3600 * 1000)
        }
      ]
    });

    const inProgressComplaint = await Complaint.create({
      complaintId: 'CMP-1002',
      title: 'Unusual continuous load during non-operational hours',
      category: 'High electricity consumption',
      description: 'Our BKC commercial facility HVAC system is drawing continuous 140 kWh throughout Sunday midnight even though all chillers were off.',
      viewerId: viewer1._id,
      viewerName: viewer1.name,
      viewerEmail: viewer1.email,
      assignedManagerId: manager._id,
      assignedManagerName: manager.name,
      location: 'Mumbai - BKC Distribution Hub',
      meterId: 'MTR-MUM-02',
      priority: 'High',
      status: 'In Progress',
      managerResponse: 'Reviewing automated BMS schedules with facility electricians. Diagnostic logger installed.',
      resolutionDetails: '',
      createdAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
      messages: [
        {
          senderId: viewer1._id,
          senderName: viewer1.name,
          senderRole: 'Viewer',
          message: 'The load remained flat at 140 kWh all night. Suspect a stuck relay in the secondary compressor.',
          createdAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000)
        },
        {
          senderId: manager._id,
          senderName: manager.name,
          senderRole: 'Manager',
          message: 'Thank you for the update. We have attached an IoT power analyzer to track individual feeder circuits.',
          createdAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000)
        }
      ],
      activityLog: [
        {
          action: 'Complaint Created',
          performedBy: viewer1.name,
          role: 'Viewer',
          details: 'Reported high consumption anomaly',
          timestamp: new Date(now.getTime() - 2 * 24 * 3600 * 1000)
        },
        {
          action: 'Status changed from Pending to In Progress',
          performedBy: manager.name,
          role: 'Manager',
          details: 'Analyzer installed on feeder',
          timestamp: new Date(now.getTime() - 1 * 24 * 3600 * 1000)
        }
      ]
    });

    // 8. Seed Notifications
    const notifications = [
      {
        recipient: viewer1._id,
        type: 'COMPLAINT_RESOLVED',
        title: 'Complaint CMP-1001 Resolved',
        message: 'Manager resolved your complaint "Discrepancy in Phase 2 BKC Sub-meter 01". Sensor replaced & verified.',
        relatedId: resolvedComplaint._id.toString(),
        read: false,
        createdAt: new Date(now.getTime() - 24 * 3600 * 1000)
      },
      {
        recipient: viewer1._id,
        type: 'STATUS_CHANGE',
        title: 'Status: In Progress for CMP-1002',
        message: 'Your complaint "Unusual continuous load during non-operational hours" is being investigated by the Manager.',
        relatedId: inProgressComplaint._id.toString(),
        read: true,
        createdAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000)
      },
      {
        recipient: manager._id,
        type: 'HIGH_CONSUMPTION',
        title: 'High Load Alert: Mumbai BKC',
        message: 'Meter MTR-MUM-01 registered 188.0 kWh exceeding location threshold.',
        relatedId: '',
        read: false,
        createdAt: new Date(now.getTime() - 3 * 24 * 3600 * 1000)
      },
      {
        recipient: admin._id,
        type: 'HIGH_CONSUMPTION',
        title: 'Critical Spike: Pune Hinjewadi',
        message: 'Critical threshold crossed (245.5 kWh) at Hinjewadi Substation.',
        relatedId: '',
        read: false,
        createdAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000)
      }
    ];

    await Notification.insertMany(notifications);

    console.log('✅ PowerPulse database seeded with Indian Locations!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
};

module.exports = seedDatabase;
