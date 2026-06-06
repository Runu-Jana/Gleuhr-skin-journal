require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Fail fast with a clear message if required env vars are missing
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'MONGODB_URI'];
const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error('\n[ERROR] Missing required environment variables:', missing.join(', '));
  console.error('        Copy .env.example to .env and fill in the values:');
  console.error('        cp .env.example .env\n');
  process.exit(1);
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/mongodb');

const app = express();
const httpServer = http.createServer(app);
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

// CORS: restrict to CLIENT_URL in production, allow all in development
const corsOrigin = (process.env.NODE_ENV === 'production' && process.env.CLIENT_URL)
  ? process.env.CLIENT_URL.split(',').map(o => o.trim()).filter(Boolean)
  : true;
app.use(cors({ origin: corsOrigin, credentials: true }));

// Socket.io for WebRTC signaling (video consultations)
const io = new Server(httpServer, {
  cors: { origin: corsOrigin, credentials: true }
});

// Track active consultation rooms: roomId → Set of socket ids
const consultationRooms = new Map();

io.on('connection', (socket) => {
  socket.on('join-consultation', (roomId) => {
    if (!consultationRooms.has(roomId)) consultationRooms.set(roomId, new Set());
    const room = consultationRooms.get(roomId);
    if (room.size >= 2) {
      socket.emit('room-full');
      return;
    }
    room.add(socket.id);
    socket.join(roomId);
    socket.data.roomId = roomId;
    if (room.size === 2) io.to(roomId).emit('ready');
  });

  socket.on('webrtc-offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('webrtc-offer', offer);
  });

  socket.on('webrtc-answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('webrtc-answer', answer);
  });

  socket.on('webrtc-ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('webrtc-ice-candidate', candidate);
  });

  socket.on('leave-consultation', (roomId) => {
    socket.to(roomId).emit('peer-left');
    socket.leave(roomId);
    const room = consultationRooms.get(roomId);
    if (room) {
      room.delete(socket.id);
      if (room.size === 0) consultationRooms.delete(roomId);
    }
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit('peer-left');
      const room = consultationRooms.get(roomId);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) consultationRooms.delete(roomId);
      }
    }
  });
});

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
const adminAuth = require('./middleware/adminAuth');
app.use('/api/admin/diet-plans', adminAuth, require('./routes/admin-diet-plans'));
app.use('/api/admin/patients', adminAuth, require('./routes/admin-patients'));
app.use('/api/admin/dietician', adminAuth, require('./routes/admin-dietician'));
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

// Connect to MongoDB at module load — works for both traditional server and Vercel serverless
const dbReady = connectDB();

// Only start the HTTP listener when run directly (not in serverless / tests)
if (require.main === module) {
  dbReady.then(async () => {
    // Seed test data in development (only if DB is connected)
    const mongoose = require('mongoose');
    if (process.env.NODE_ENV === 'development' && mongoose.connection.readyState === 1) {
      const seedTestData = require('./config/seedTestData');
      await seedTestData();
    }

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Local: http://localhost:${PORT}`);
    });
  });
}

module.exports = { app, httpServer };
