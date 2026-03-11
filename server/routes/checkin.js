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
      amRoutine,
      pmRoutine,
      sunscreen,
      dietFollowed,
      triggerFoods,
      waterIntake,
      skinMood,
      skinScore,
      skinScores,
      mood,
      energy,
      sleep,
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

    // Create or update check-in record
    let checkin;
    const existingCheckin = await DailyCheckIn.findOne({
      patientId: patient._id.toString(),
      date
    });

    const checkinData = {
      patientId: patient._id.toString(),
      patientPhone: patient.phone || patient.phoneNumber,
      dayOfJourney,
      amRoutine: amRoutine || false,
      pmRoutine: pmRoutine || false,
      sunscreen: sunscreen || false,
      dietFollowed: dietFollowed || 'No',
      triggerFoods: triggerFoods || [],
      waterIntake: waterIntake || 0,
      skinMood: skinMood || 'Okay',
      // Skin assessment fields
      skinScore: skinScore !== undefined ? skinScore : undefined,
      skinScores: skinScores || undefined,
      // Wellness fields
      mood: mood || undefined,
      energy: energy || undefined,
      sleep: sleep !== undefined ? sleep : undefined,
      medications: medications || [],
      symptoms: symptoms || [],
      notes: notes || '',
      completed: true,
      completedAt: new Date()
    };

    if (existingCheckin) {
      // Update existing check-in
      checkin = await DailyCheckIn.findByIdAndUpdate(existingCheckin._id, checkinData, { new: true });
    } else {
      // Create new check-in record
      checkin = new DailyCheckIn({
        ...checkinData,
        date
      });
      await checkin.save();
    }

    // Update streak
    await updateStreak(patient.phone || patient.phoneNumber, dayOfJourney, patient._id.toString());

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
      amRoutine: record.amRoutine,
      pmRoutine: record.pmRoutine,
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

// Helper to update streak — recalculates from actual DailyCheckIn records
async function updateStreak(phoneNumber, currentDay, patientId = null) {
  try {
    // Fetch all check-ins for this patient
    const orClauses = [{ patientPhone: phoneNumber }];
    if (patientId) orClauses.push({ patientId });
    const allCheckIns = await DailyCheckIn.find({ $or: orClauses }).sort({ date: 1 });

    // Dates with at least one completed routine
    const activeDates = new Set(
      allCheckIns.filter(c => c.amRoutine || c.pmRoutine).map(c => c.date)
    );

    if (activeDates.size === 0) return;

    const sorted = [...activeDates].sort();

    // Longest streak: max consecutive run of active dates
    let longestStreak = 1;
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.round((new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000);
      if (diff === 1) {
        run++;
        if (run > longestStreak) longestStreak = run;
      } else {
        run = 1;
      }
    }

    // Current streak: consecutive active dates ending at today or yesterday
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let currentStreak = 0;
    const startOffset = activeDates.has(todayStr) ? 0 : activeDates.has(yesterdayStr) ? 1 : -1;
    if (startOffset >= 0) {
      for (let i = startOffset; i <= sorted.length; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        if (activeDates.has(dateStr)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    if (currentStreak > longestStreak) longestStreak = currentStreak;

    await Streak.findOneAndUpdate(
      { $or: orClauses },
      { currentStreak, longestStreak, lastCheckIn: new Date(), day: currentDay, patientPhone: phoneNumber, ...(patientId && { patientId }) },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Update streak error:', error);
  }
}

module.exports = router;
