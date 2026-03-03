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
        longestStreak: 0,
        shields: 0,
        lastCheckin: null,
        day: 1
      });
    }

    // Find streak for this patient
    const streak = await Streak.findOne({
      $or: [
        { phoneNumber: phone },
        { phone: phone },
        { patientPhone: phone }
      ]
    });

    if (!streak) {
      return res.json({
        streak: 0,
        longestStreak: 0,
        shields: 0,
        lastCheckin: null,
        day: patient.currentDay || 1
      });
    }

    const currentStreak = streak.currentStreak || 0;
    const longestStreak = streak.longestStreak || 0;
    
    // Check and reset monthly shields if needed
    const currentMonth = new Date().toISOString().slice(0, 7);
    const availableShields = (streak.shields?.lastResetMonth === currentMonth) 
      ? (streak.shields?.monthly || 3) - (streak.shields?.used || 0)
      : 3; // New month, reset to 3
    
    // Calculate shields (1 per 7 days, max 3)
    const earnedShields = Math.min(3, Math.floor(currentStreak / 7));

    res.json({
      streak: currentStreak,
      longestStreak: longestStreak,
      shields: earnedShields,
      restorationShields: {
        available: availableShields,
        monthly: 3,
        used: streak.shields?.used || 0,
        lastResetMonth: currentMonth
      },
      lastCheckin: streak.lastCheckIn,
      day: streak.day || patient.currentDay || 1
    });
  } catch (error) {
    console.error('Fetch streak error:', error);
    res.status(500).json({ error: 'Failed to fetch streak data' });
  }
});

// POST /api/streak/restore - Use shield to restore streak
router.post('/restore', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    // Find patient
    const patient = await Patient.findOne({
      $or: [
        { phoneNumber },
        { phone: phoneNumber }
      ]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Find streak
    const streak = await Streak.findOne({
      $or: [
        { phoneNumber },
        { phone: phoneNumber },
        { patientPhone: phoneNumber }
      ]
    });

    if (!streak) {
      return res.status(404).json({ error: 'No streak data found' });
    }

    // Check and reset monthly shields if needed
    const currentMonth = new Date().toISOString().slice(0, 7);
    let availableShields;

    if (streak.shields?.lastResetMonth === currentMonth) {
      availableShields = (streak.shields?.monthly || 3) - (streak.shields?.used || 0);
    } else {
      // New month, reset shields
      availableShields = 3;
      streak.shields = {
        monthly: 3,
        used: 0,
        lastResetMonth: currentMonth
      };
    }

    if (availableShields <= 0) {
      return res.status(400).json({ error: 'No shields available this month' });
    }

    // Use shield to restore streak (restore to previous day's streak + 1)
    const previousStreak = streak.currentStreak || 0;
    const restoredStreak = Math.max(1, previousStreak + 1);

    // Update streak and shield usage
    await Streak.findByIdAndUpdate(streak._id, {
      currentStreak: restoredStreak,
      shields: {
        monthly: 3,
        used: (streak.shields?.used || 0) + 1,
        lastResetMonth: currentMonth
      },
      lastCheckinDate: new Date()
    });

    res.json({
      success: true,
      message: 'Streak restored successfully!',
      previousStreak: previousStreak,
      restoredStreak: restoredStreak,
      shieldsRemaining: availableShields - 1
    });

  } catch (error) {
    console.error('Restore streak error:', error);
    res.status(500).json({ error: 'Failed to restore streak' });
  }
});

module.exports = router;
