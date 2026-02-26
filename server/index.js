require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (needed for rate limiting behind proxy)
app.set('trust proxy', 1);

// Rate limiting - skip for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in dev
  keyGenerator: (req) => req.ip // Use IP for rate limiting
});

app.use(limiter);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../client/build')));

// Routes (All MongoDB-based)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/self-register', require('./routes/self-register'));
app.use('/api/patient', require('./routes/patient'));
app.use('/api/photo', require('./routes/photo'));
app.use('/api/streak', require('./routes/streak'));
app.use('/api/skinscore', require('./routes/skinscore'));
app.use('/api/checkin', require('./routes/checkin'));
app.use('/api/reorder', require('./routes/reorder'));

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
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer();
