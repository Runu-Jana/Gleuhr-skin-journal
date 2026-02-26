const express = require('express');
const router = express.Router();
const { base, TABLES } = require('../config/airtable');

// POST /api/reorder/click - Log banner click event
router.post('/click', async (req, res) => {
  try {
    const {
      patientId,
      patientEmail,
      day,
      timestamp
    } = req.body;

    if (!patientEmail || !day) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const record = await base(TABLES.REORDER_EVENTS).create([
      {
        fields: {
          'Patient ID': patientId || '',
          'Patient Email': patientEmail,
          'Day': day,
          'Timestamp': timestamp || new Date().toISOString(),
          'Event Type': 'Reorder Banner Click'
        }
      }
    ]);

    res.json({
      success: true,
      id: record[0].id,
      message: 'Click event logged'
    });
  } catch (error) {
    console.error('Reorder click error:', error);
    res.status(500).json({ error: 'Failed to log click event' });
  }
});

module.exports = router;
