const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'GET',
      headers
    }, res => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  try {
    const login = await post('/api/auth/login', { email: 'admin@powerpulse.io', password: 'admin123' });
    console.log('✓ Login response:', login.success, login.user);

    const summary = await get('/api/analytics/summary', login.token);
    console.log('✓ Analytics Summary KPIs:', summary.summary);

    const readings = await get('/api/readings?limit=3', login.token);
    console.log('✓ Total Readings:', readings.total, 'Count:', readings.count);

    const alerts = await get('/api/alerts', login.token);
    console.log('✓ Alerts total:', alerts.count, 'Unresolved count:', alerts.unresolvedCount);

    const locs = await get('/api/locations', login.token);
    console.log('✓ Locations total:', locs.count);
  } catch (err) {
    console.error('Test error:', err);
  }
}

run();
