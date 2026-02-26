const express = require('express');
const router = express.Router();
const ReorderEvent = require('../models/ReorderEvent');

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

    const reorderEvent = new ReorderEvent({
      patientId: patientId || '',
      patientEmail,
      day,
      eventType: 'Reorder Banner Click',
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    await reorderEvent.save();

    res.json({
      success: true,
      id: reorderEvent._id,
      message: 'Click event logged'
    });
  } catch (error) {
    console.error('Reorder click error:', error);
    res.status(500).json({ error: 'Failed to log click event' });
  }
});

module.exports = router;
