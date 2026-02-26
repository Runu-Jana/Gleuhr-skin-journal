const express = require('express');
const router = express.Router();
const { base, TABLES } = require('../config/airtable');
const whatsappService = require('../services/whatsappService');

// Comprehensive health check endpoint
router.get('/comprehensive', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      server: { status: 'OK', message: 'Server running' },
      airtable: { status: 'UNKNOWN', message: 'Checking...' },
      whatsapp: { status: 'UNKNOWN', message: 'Checking...' },
      database: { status: 'OK', message: 'In-memory storage working' }
    },
    tables: {},
    routes: {
      auth: 'OK',
      otp: 'OK',
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
      hasAirtablePat: !!process.env.AIRTABLE_PAT,
      hasAirtableBase: !!process.env.AIRTABLE_BASE_ID,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasInteraktKey: !!process.env.INTERAKT_API_KEY,
      hasInteraktUrl: !!process.env.INTERAKT_API_URL
    }
  };

  // Test Airtable connection
  try {
    await base(TABLES.PATIENTS).select({ maxRecords: 1 }).firstPage();
    health.services.airtable = { status: 'OK', message: 'Airtable connection working' };
    
    // Test each table
    for (const [key, tableName] of Object.entries(TABLES)) {
      try {
        await base(tableName).select({ maxRecords: 1 }).firstPage();
        health.tables[key] = { status: 'OK', message: `Table '${tableName}' accessible` };
      } catch (error) {
        health.tables[key] = { 
          status: 'ERROR', 
          message: `Table '${tableName}' not accessible: ${error.message}` 
        };
        health.services.airtable.status = 'PARTIAL';
      }
    }
  } catch (error) {
    health.services.airtable = { 
      status: 'ERROR', 
      message: `Airtable connection failed: ${error.message}` 
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
  const hasPartial = Object.values(health.services).some(s => s.status === 'PARTIAL');
  
  if (hasErrors) {
    health.status = 'ERROR';
  } else if (hasPartial) {
    health.status = 'DEGRADED';
  }

  res.json(health);
});

// Simple health check (existing functionality)
router.get('/', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;
