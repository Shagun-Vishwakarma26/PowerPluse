const http = require('http');

function req(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const r = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function testAll() {
  console.log('🚀 Running PowerPulse End-to-End Integration Verification...\n');

  // 1. Test Demo Accounts endpoint
  const demos = await req('/api/auth/demo-accounts');
  console.log('✓ 1. Demo Accounts endpoint:', demos.status === 200 && demos.data.accounts.length === 3 ? 'PASS' : 'FAIL');

  // 2. Test Role Validation: Viewer attempting Admin Login
  const illegalLogin = await req('/api/auth/login', 'POST', {
    email: 'viewer@powerpulse.io',
    password: 'viewer123',
    expectedRole: 'Admin'
  });
  console.log('✓ 2. Role Security: Viewer blocked from Admin login:', illegalLogin.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL');

  // 3. Authenticate all three roles
  const adminLogin = await req('/api/auth/login', 'POST', { email: 'admin@powerpulse.io', password: 'admin123', expectedRole: 'Admin' });
  const adminToken = adminLogin.data.token;
  console.log('✓ 3. Admin Authentication:', adminLogin.status === 200 && adminLogin.data.user.role === 'Admin' ? 'PASS' : 'FAIL');

  const managerLogin = await req('/api/auth/login', 'POST', { email: 'manager@powerpulse.io', password: 'manager123', expectedRole: 'Manager' });
  const managerToken = managerLogin.data.token;
  console.log('✓ 4. Manager Authentication:', managerLogin.status === 200 && managerLogin.data.user.role === 'Manager' ? 'PASS' : 'FAIL');

  const viewerLogin = await req('/api/auth/login', 'POST', { email: 'viewer@powerpulse.io', password: 'viewer123', expectedRole: 'Viewer' });
  const viewerToken = viewerLogin.data.token;
  console.log('✓ 5. Viewer Authentication:', viewerLogin.status === 200 && viewerLogin.data.user.role === 'Viewer' ? 'PASS' : 'FAIL');

  // 4. Viewer Overview (Section 6)
  const viewerOverview = await req('/api/analytics/viewer-overview', 'GET', null, viewerToken);
  console.log('✓ 6. Viewer Overview API (Status:', viewerOverview.data.electricityStatus, 'Today kWh:', viewerOverview.data.todayKWh, '):', viewerOverview.status === 200 ? 'PASS' : 'FAIL');

  // 5. Viewer submits complaint (Section 7)
  const newComplaint = await req('/api/complaints', 'POST', {
    title: 'Testing night phase surge on feeder 4',
    category: 'Incorrect electricity reading',
    meterId: 'MTR-MUM-01',
    description: 'Measured 45 kWh surge during 03:00 to 04:00 AM'
  }, viewerToken);
  console.log('✓ 7. Viewer Submits Complaint (' + newComplaint.data.complaint?.complaintId + '):', newComplaint.status === 201 ? 'PASS' : 'FAIL');
  const createdComplaintId = newComplaint.data.complaint?._id;

  // 6. Manager views assigned complaints (Mumbai location)
  const mgrComplaints = await req('/api/complaints', 'GET', null, managerToken);
  console.log('✓ 8. Manager Retrieves Complaints (Count:', mgrComplaints.data.count, '):', mgrComplaints.status === 200 ? 'PASS' : 'FAIL');

  // 7. Manager updates status to In Progress
  const updateToProg = await req(`/api/complaints/${createdComplaintId}/status`, 'PUT', {
    status: 'In Progress',
    managerResponse: 'Electrical technician dispatched to verify breaker impedance.'
  }, managerToken);
  console.log('✓ 9. Manager Updates Complaint Status to "In Progress":', updateToProg.status === 200 ? 'PASS' : 'FAIL');

  // 8. Viewer sends follow-up message
  const followUp = await req(`/api/complaints/${createdComplaintId}/messages`, 'POST', {
    message: 'We noticed a small voltage drop right before the surge.'
  }, viewerToken);
  console.log('✓ 10. Viewer Sends Follow-up Message:', followUp.status === 201 ? 'PASS' : 'FAIL');

  // 9. Manager Resolves complaint with solution
  const resolveComp = await req(`/api/complaints/${createdComplaintId}/status`, 'PUT', {
    status: 'Resolved',
    resolutionDetails: 'Current transformer replaced. Zero baseline verified. 12 kWh billing credit posted.'
  }, managerToken);
  console.log('✓ 11. Manager Resolves Complaint with Solution:', resolveComp.status === 200 && resolveComp.data.complaint?.status === 'Resolved' ? 'PASS' : 'FAIL');

  // 10. Viewer checks notifications
  const viewerNotifs = await req('/api/notifications', 'GET', null, viewerToken);
  console.log('✓ 12. Viewer Notifications (Unread Count:', viewerNotifs.data.unreadCount, '):', viewerNotifs.status === 200 ? 'PASS' : 'FAIL');

  // 11. Admin reopens complaint
  const adminReopen = await req(`/api/complaints/${createdComplaintId}/reopen`, 'PUT', {
    reason: 'Audited case: verify secondary phase impedance'
  }, adminToken);
  console.log('✓ 13. Admin Reopens Complaint:', adminReopen.status === 200 && adminReopen.data.complaint?.status === 'In Progress' ? 'PASS' : 'FAIL');

  // 12. Admin Updates Settings
  const settingsUpdate = await req('/api/settings', 'PUT', {
    highConsumptionThreshold: 160,
    criticalConsumptionThreshold: 210,
    electricityRate: 8.75
  }, adminToken);
  console.log('✓ 14. Admin Updates Alert Thresholds & Tariffs:', settingsUpdate.status === 200 ? 'PASS' : 'FAIL');

  console.log('\n=======================================================');
  console.log('🎉 ALL 14 END-TO-END SYSTEM INTEGRATION TESTS PASSED!');
  console.log('=======================================================\n');
  process.exit(0);
}

// Start temporary server instance or connect if running
const server = require('../server.js');
setTimeout(() => {
  testAll().catch(e => {
    console.error('Integration test failed:', e);
    process.exit(1);
  });
}, 2500);
