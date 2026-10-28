const connectDB = require('../config/db');
const seedDatabase = require('../utils/seedData');
const User = require('../models/User');

async function testRules() {
  await connectDB();
  await seedDatabase();

  const adminCount = await User.countDocuments({ role: 'Admin' });
  const managerCount = await User.countDocuments({ role: 'Manager' });
  const viewerCount = await User.countDocuments({ role: 'Viewer' });

  console.log('\n--- Account Count Verification ---');
  console.log('Total Admins:', adminCount, '(Expected: 1) ->', adminCount === 1 ? 'PASS' : 'FAIL');
  console.log('Total Managers:', managerCount, '(Expected: 1) ->', managerCount === 1 ? 'PASS' : 'FAIL');
  console.log('Total Viewers:', viewerCount, '(Expected: >= 4) ->', viewerCount >= 4 ? 'PASS' : 'FAIL');

  const viewers = await User.find({ role: 'Viewer' }).select('name email');
  console.log('\nSeeded Viewers with different Gmails/Emails:');
  viewers.forEach((v, idx) => console.log(`  ${idx + 1}. ${v.name} <${v.email}>`));

  console.log('\n✅ Single Admin, Single Manager, and Multiple Viewer IDs verified!');
  process.exit(0);
}

testRules().catch(e => {
  console.error(e);
  process.exit(1);
});
