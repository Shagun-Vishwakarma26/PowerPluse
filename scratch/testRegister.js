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

async function test() {
  const reg = await post('/api/auth/register', {
    name: 'Shagufta Project Admin',
    email: 'shagufta@gmail.com',
    password: 'password123'
  });
  console.log('✓ Registered Gmail User:', reg.success, reg.user);

  const summary = await get('/api/analytics/summary', reg.token);
  console.log('✓ Sustainability Metrics:', {
    co2Emissions: summary.summary.co2EmissionTonnes + ' Tonnes',
    treesEquivalent: summary.summary.treesEquivalent,
    costForecast: '₹' + summary.summary.projectedMonthlyCost,
    powerFactor: summary.summary.powerFactor
  });
}

test();
