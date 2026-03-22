require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (needed for rate limiting behind proxy)
app.set('trust proxy', 1);

// General rate limiter: 200 req / 15 min per IP (skipped in development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many requests, please try again later.' }
});

// Strict limiter for auth endpoints: 10 req / 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: (req) => process.env.NODE_ENV === 'development',
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

app.use(limiter);
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../client/build')));

// Serve PWA icons and manifest from public folder
app.use(express.static(path.join(__dirname, '../client/public')));

// Dietician routes (before admin routes)
app.use('/api/dietician/auth', authLimiter, require('./routes/dietician-auth'));
app.use('/api/dietician', require('./routes/dietician'));

// Routes (All MongoDB-based)
app.use('/api/admin/auth', authLimiter, require('./routes/admin-auth'));
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/self-register', require('./routes/self-register'));
app.use('/api/patient', require('./routes/patient'));
app.use('/api/photo', require('./routes/photo'));
app.use('/api/streak', require('./routes/streak'));
app.use('/api/skinscore', require('./routes/skinscore'));
app.use('/api/checkin', require('./routes/checkin'));
app.use('/api/reorder', require('./routes/reorder'));
app.use('/api/admin/diet-plans', require('./routes/admin-diet-plans'));
app.use('/api/admin/patients', require('./routes/admin-patients'));
app.use('/api/admin/dietician', require('./routes/admin-dietician'));
app.use('/api/admin/overview', require('./routes/admin-overview'));

// Admin routes
app.use('/api/admin', require('./admin'));

// Health check
app.use('/api/health', require('./routes/health'));

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Connect to MongoDB first, then start the server
const startServer = async () => {
  await connectDB();

  // Seed test data in development (only if DB is connected)
  const mongoose = require('mongoose');
  if (process.env.NODE_ENV === 'development' && mongoose.connection.readyState === 1) {
    const seedTestData = require('./config/seedTestData');
    await seedTestData();
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Local: http://localhost:${PORT}`);
  });
};

// Only auto-start when run directly (not when required by tests)
if (require.main === module) {
  startServer();
}

module.exports = app;
