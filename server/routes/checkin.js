const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const DailyCheckIn = require('../models/DailyCheckIn');
const Streak = require('../models/Streak');
const whatsappService = require('../services/whatsappService');

// POST /api/checkin - Save daily check-in
router.post('/', async (req, res) => {
  try {
    const {
      patientId,
      date,
      day,
      amRoutine,
      pmRoutine,
      sunscreen,
      dietFollowed,
      triggerFoods,
      waterIntake,
      skinMood,
      notes
    } = req.body;

    // Validate required fields
    if (!patientId || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Create check-in record
    const checkin = new DailyCheckin({
      patient: patientId,
      date,
      day,
      amRoutine: amRoutine || false,
      pmRoutine: pmRoutine || false,
      sunscreen: sunscreen || false,
      dietFollowed: dietFollowed || 'Yes',
      triggerFoods: triggerFoods ? triggerFoods.join(', ') : '',
      waterIntake: waterIntake || 2,
      skinMood: skinMood || 'Okay',
      notes: notes || '',
      synced: true
    });

    await checkin.save();

    // Update streak
    await updateStreak(patient.phone || patient.phoneNumber, day);

    // Update patient progress
    await Patient.findByIdAndUpdate(patientId, {
      currentDay: day,
      completionPercentage: Math.round((day / 90) * 100)
    });

    res.json({
      success: true,
      id: checkin._id,
      message: 'Check-in saved successfully'
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to save check-in' });
  }
});

// GET /api/checkin/:phone - Get check-ins for a patient
router.get('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    // Find patient by phone number (support both field names)
    const patient = await Patient.findOne({
      $or: [
        { phoneNumber: phone },
        { phone: phone }
      ]
    });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Get check-ins for this patient
    const checkins = await DailyCheckin.find({ patient: patient._id })
      .sort({ date: -1 });

    const checkinData = checkins.map(record => ({
      id: record._id,
      date: record.date,
      day: record.day,
      amRoutine: record.amRoutine,
      pmRoutine: record.pmRoutine,
      sunscreen: record.sunscreen,
      dietFollowed: record.dietFollowed,
      triggerFoods: record.triggerFoods ? record.triggerFoods.split(', ') : [],
      waterIntake: record.waterIntake,
      skinMood: record.skinMood,
      notes: record.notes
    }));

    res.json(checkinData);
  } catch (error) {
    console.error('Fetch check-ins error:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

// Helper to update streak
async function updateStreak(phoneNumber, currentDay) {
  try {
    // Find existing streak (support both field names)
    let streak = await Streak.findOne({
      $or: [
        { phoneNumber: phoneNumber },
        { phone: phoneNumber }
      ]
    });
    
    const today = new Date().toISOString().split('T')[0];

    if (streak) {
      const currentStreak = streak.currentStreak || 0;
      const lastCheckin = streak.lastCheckinDate;
      
      // Calculate if streak continues
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      let newStreak = currentStreak;
      if (lastCheckin === yesterdayStr) {
        newStreak = currentStreak + 1;
      } else if (lastCheckin !== today) {
        newStreak = 1;
      }

      await Streak.findByIdAndUpdate(streak._id, {
        currentStreak: newStreak,
        lastCheckinDate: today,
        day: currentDay
      });
    } else {
      // Create new streak record
      streak = new Streak({
        phoneNumber,
        currentStreak: 1,
        lastCheckinDate: today,
        day: currentDay
      });
      await streak.save();
    }
  } catch (error) {
    console.error('Update streak error:', error);
  }
}

module.exports = router;
