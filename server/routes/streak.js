const express = require('express');
const router = express.Router();
const Streak = require('../models/Streak');
const Patient = require('../models/Patient');

// GET /api/streak/:phone - Get current streak data by phone
router.get('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    // Find patient by phone (support both field names)
    const patient = await Patient.findOne({
      $or: [
        { phoneNumber: phone },
        { phone: phone }
      ]
    });

    if (!patient) {
      return res.json({
        streak: 0,
        shields: 0,
        lastCheckin: null,
        day: 1
      });
    }

    // Find streak for this patient
    const streak = await Streak.findOne({
      $or: [
        { phoneNumber: phone },
        { phone: phone }
      ]
    });

    if (!streak) {
      return res.json({
        streak: 0,
        shields: 0,
        lastCheckin: null,
        day: patient.currentDay || 1
      });
    }

    const currentStreak = streak.currentStreak || 0;
    
    // Calculate shields (1 per 7 days, max 3)
    const shields = Math.min(3, Math.floor(currentStreak / 7));

    res.json({
      streak: currentStreak,
      shields: shields,
      lastCheckin: streak.lastCheckinDate,
      day: streak.day || patient.currentDay || 1
    });
  } catch (error) {
    console.error('Fetch streak error:', error);
    res.status(500).json({ error: 'Failed to fetch streak data' });
  }
});

module.exports = router;
