const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const whatsappService = require('../services/whatsappService');

// Comprehensive health check endpoint
router.get('/comprehensive', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      server: { status: 'OK', message: 'Server running' },
      mongodb: { status: 'UNKNOWN', message: 'Checking...' },
      whatsapp: { status: 'UNKNOWN', message: 'Checking...' }
    },
    routes: {
      auth: 'OK',
      patient: 'OK',
      photo: 'OK',
      streak: 'OK',
      skinscore: 'OK',
      checkin: 'OK',
      reorder: 'OK'
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 5000,
      hasMongoUri: !!process.env.MONGODB_URI,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasInteraktKey: !!process.env.INTERAKT_API_KEY,
      hasInteraktUrl: !!process.env.INTERAKT_API_URL
    }
  };

  // Test MongoDB connection
  try {
    const state = mongoose.connection.readyState;
    if (state === 1) {
      health.services.mongodb = { status: 'OK', message: 'MongoDB connected' };
    } else if (state === 2) {
      health.services.mongodb = { status: 'CONNECTING', message: 'MongoDB connecting...' };
    } else {
      health.services.mongodb = { status: 'ERROR', message: 'MongoDB disconnected' };
      health.status = 'DEGRADED';
    }
  } catch (error) {
    health.services.mongodb = {
      status: 'ERROR',
      message: `MongoDB error: ${error.message}`
    };
    health.status = 'DEGRADED';
  }

  // Test WhatsApp service
  try {
    const whatsappTest = await whatsappService.testConnection();
    health.services.whatsapp = {
      status: whatsappTest.success ? 'OK' : 'ERROR',
      message: whatsappTest.success ? 'Interakt API accessible' : `Interakt API error: ${whatsappTest.error}`
    };
    if (!whatsappTest.success) {
      health.status = 'DEGRADED';
    }
  } catch (error) {
    health.services.whatsapp = {
      status: 'ERROR',
      message: `WhatsApp service error: ${error.message}`
    };
    health.status = 'DEGRADED';
  }

  // Determine overall status
  const hasErrors = Object.values(health.services).some(s => s.status === 'ERROR');
  if (hasErrors) {
    health.status = 'ERROR';
  }

  res.json(health);
});

// Simple health check
router.get('/', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;
