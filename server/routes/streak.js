const express = require('express');
const router = express.Router();
const Streak = require('../models/Streak');
const Patient = require('../models/Patient');
const DailyCheckIn = require('../models/DailyCheckIn');

// GET /api/streak/:phone - Get current streak data by phone
router.get('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;

    // Find patient by phone (support both field names)
    const patient = await Patient.findOne({
      $or: [{ phoneNumber: phone }, { phone: phone }]
    });

    if (!patient) {
      return res.json({ streak: 0, longestStreak: 0, shields: 0, lastCheckin: null, day: 1 });
    }

    // ── Recalculate streak live from DailyCheckIn records ──────────────────
    // This is the source of truth; avoids stale cached values in the Streak collection.
    const patientIdStr = patient._id.toString();
    const allCheckIns = await DailyCheckIn.find({
      $or: [{ patientId: patientIdStr }, { patientPhone: phone }]
    }).sort({ date: 1 });

    // Count any day where at least one routine was logged (AM or PM) or shield was used.
    // This matches the client-side logic and prevents discrepancies where a day with
    // only AM logged would not be counted by the server but would be by the client.
    const activeDates = new Set(
      allCheckIns
        .filter(c => c.amRoutine === true || c.pmRoutine === true || c.shieldRestored === true)
        .map(c => (c.date instanceof Date ? c.date.toISOString().split('T')[0] : String(c.date).split('T')[0]))
    );
    const sorted = [...activeDates].sort();

    // Longest streak
    let longestStreak = activeDates.size > 0 ? 1 : 0;
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.round((new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000);
      if (diff === 1) { run++; if (run > longestStreak) longestStreak = run; }
      else { run = 1; }
    }

    // Current streak (consecutive active days ending at today or yesterday)
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
        if (activeDates.has(d.toISOString().split('T')[0])) { currentStreak++; }
        else { break; }
      }
    }
    if (currentStreak > longestStreak) longestStreak = currentStreak;

    // ── Find (or create) the Streak record for shield data ─────────────────
    const currentMonth = new Date().toISOString().slice(0, 7);
    let streak = await Streak.findOne({
      $or: [{ patientId: patientIdStr }, { patientPhone: phone }]
    });

    // Sync the recalculated streak back to DB so it stays up to date
    if (streak) {
      await Streak.findByIdAndUpdate(streak._id, { currentStreak, longestStreak });
    } else if (currentStreak > 0) {
      streak = await Streak.findOneAndUpdate(
        { $or: [{ patientId: patientIdStr }, { patientPhone: phone }] },
        { currentStreak, longestStreak, patientPhone: phone, patientId: patientIdStr },
        { upsert: true, new: true }
      );
    }

    const availableShields = streak && streak.shields?.lastResetMonth === currentMonth
      ? (streak.shields?.monthly || 3) - (streak.shields?.used || 0)
      : 3;
    const earnedShields = Math.min(3, Math.floor(currentStreak / 7));

    res.json({
      streak: currentStreak,
      longestStreak,
      shields: earnedShields,
      restorationShields: {
        available: availableShields,
        monthly: 3,
        used: streak?.shields?.used || 0,
        lastResetMonth: currentMonth
      },
      lastCheckin: streak?.lastCheckIn || null,
      day: streak?.day || patient.currentDay || 1
    });
  } catch (error) {
    console.error('Fetch streak error:', error);
    res.status(500).json({ error: 'Failed to fetch streak data' });
  }
});

// POST /api/streak/restore - Use shield to restore streak
router.post('/restore', async (req, res) => {
  try {
    // Accept both 'phone' and 'phoneNumber' from request body
    const phoneNumber = req.body.phoneNumber || req.body.phone;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required (send as phone or phoneNumber)' });
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

    // Find or create streak document
    let streak = await Streak.findOne({
      $or: [{ patientPhone: phoneNumber }, { patientId: patient._id.toString() }]
    });

    if (!streak) {
      streak = await Streak.create({
        patientId: patient._id.toString(),
        patientPhone: phoneNumber,
      });
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

    // ── Create a "shield-restored" DailyCheckIn for the missed day ────────────
    // The record has amRoutine/pmRoutine = false so dieticians can see the gap,
    // but completed = true so streak counters count the day.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const patientIdStr = patient._id.toString();
    const patientPhone = patient.phone || patient.phoneNumber;
    const dayOfJourney = streak.day || patient.currentDay || 1;

    let shieldCheckin;
    const yesterdayDateObj = new Date(yesterdayStr + 'T00:00:00.000Z');
    const existingCheckin = await DailyCheckIn.findOne({
      patientId: patientIdStr,
      date: { $gte: yesterdayDateObj, $lt: new Date(yesterdayDateObj.getTime() + 86400000) }
    });

    if (existingCheckin) {
      shieldCheckin = await DailyCheckIn.findByIdAndUpdate(
        existingCheckin._id,
        { shieldRestored: true, completed: true, completedAt: new Date() },
        { new: true }
      );
    } else {
      shieldCheckin = await DailyCheckIn.create({
        patientId: patientIdStr,
        patientPhone,
        date: yesterdayDateObj,
        dayOfJourney,
        amRoutine: false,
        pmRoutine: false,
        sunscreen: false,
        shieldRestored: true,
        completed: true,
        completedAt: new Date(),
      });
    }

    // ── Update streak record and shield usage ─────────────────────────────────
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
      shieldsRemaining: availableShields - 1,
      shieldCheckinId: shieldCheckin?._id?.toString(),
    });

  } catch (error) {
    console.error('Restore streak error:', error.message, error.stack);
    res.status(500).json({ error: error.message || 'Failed to restore streak' });
  }
});

module.exports = router;
