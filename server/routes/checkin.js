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
      patientPhone,
      date,
      day,
      skinScore,
      skinScores,
      mood,
      energy,
      sleep,
      waterIntake,
      medications,
      notes,
      symptoms
    } = req.body;

    // Validate required fields - support both patientId and patientPhone
    if (!patientId && !patientPhone) {
      return res.status(400).json({ error: 'Missing patient identifier' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Missing required field: date' });
    }

    // Find patient by ID or phone
    let patient;
    if (patientId) {
      patient = await Patient.findById(patientId);
    }
    if (!patient && patientPhone) {
      patient = await Patient.findOne({
        $or: [
          { phoneNumber: patientPhone },
          { phone: patientPhone }
        ]
      });
    }
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const dayOfJourney = day || patient.currentDay || 1;

    // Create check-in record matching DailyCheckIn model schema
    const checkin = new DailyCheckIn({
      patientId: patient._id.toString(),
      patientPhone: patient.phone || patient.phoneNumber,
      date,
      dayOfJourney,
      skinScore: skinScore || 0,
      skinScores: skinScores || {},
      mood: mood || 'good',
      energy: energy || 'medium',
      sleep: sleep || 8,
      waterIntake: waterIntake || 8,
      medications: medications || [],
      notes: notes || '',
      symptoms: symptoms || [],
      completed: true,
      completedAt: new Date()
    });

    await checkin.save();

    // Update streak
    await updateStreak(patient.phone || patient.phoneNumber, dayOfJourney);

    // Update patient progress
    await Patient.findByIdAndUpdate(patient._id, {
      currentDay: dayOfJourney,
      completionPercentage: Math.round((dayOfJourney / 90) * 100)
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
    const checkins = await DailyCheckIn.find({
      $or: [
        { patientId: patient._id.toString() },
        { patientPhone: phone }
      ]
    }).sort({ date: -1 });

    const checkinData = checkins.map(record => ({
      id: record._id,
      date: record.date,
      day: record.dayOfJourney,
      skinScore: record.skinScore,
      skinScores: record.skinScores,
      mood: record.mood,
      energy: record.energy,
      sleep: record.sleep,
      waterIntake: record.waterIntake,
      medications: record.medications,
      notes: record.notes,
      symptoms: record.symptoms,
      completed: record.completed
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
