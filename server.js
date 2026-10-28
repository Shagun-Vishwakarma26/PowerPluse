const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/db');
const seedDatabase = require('./utils/seedData');
const { protect } = require('./middleware/auth');

// Import Route Handlers
const authRoutes = require('./routes/authRoutes');
const readingRoutes = require('./routes/readingRoutes');
const locationRoutes = require('./routes/locationRoutes');
const meterRoutes = require('./routes/meterRoutes');
const alertRoutes = require('./routes/alertRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const userRoutes = require('./routes/userRoutes');
const settingRoutes = require('./routes/settingRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// Connect Database & run seed
connectDB().then(() => {
  seedDatabase();
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());

// Helmet Content Security Policy for CDN script loading (Chart.js, Lucide icons, Google Fonts)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// Rate Limiter for API stability
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 1000,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

// Mount API Routes
app.use('/api/auth', authRoutes);

// Protected routes below
app.use('/api', protect);
app.use('/api/readings', readingRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/meters', meterRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notifications', notificationRoutes);

// Static frontend serving
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// Explicit routes for dashboards and logins fallback
app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/manager-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'manager-login.html')));
app.get('/viewer-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'viewer-login.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html')));
app.get('/manager-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'manager-dashboard.html')));
app.get('/viewer-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'viewer-dashboard.html')));

// Default fallback to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 PowerPulse Server running on http://localhost:${PORT}`);
  console.log(`⚡ Admin Login:   http://localhost:${PORT}/admin-login.html`);
  console.log(`⚡ Manager Login: http://localhost:${PORT}/manager-login.html`);
  console.log(`⚡ Viewer Login:  http://localhost:${PORT}/viewer-login.html`);
  console.log(`=======================================================`);
});
