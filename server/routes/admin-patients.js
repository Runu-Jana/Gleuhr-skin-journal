const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Streak = require('../models/Streak');
const DailyCheckIn = require('../models/DailyCheckIn');
const SkinScore = require('../models/SkinScore');
const ReorderEvent = require('../models/ReorderEvent');
const WeeklyPhoto = require('../models/WeeklyPhoto');
const { fetchDietPlans } = require('../services/airtableService');

/**
 * Normalize a phone number and return all possible format variants.
 * Handles: +917973944144, 917973944144, 7973944144, 07973944144
 */
function getPhoneVariants(phone) {
  if (!phone) return [];
  const stripped = phone.replace(/[\s\-\(\)]/g, '');
  // Get just the digits
  const digits = stripped.replace(/[^\d]/g, '');
  const variants = new Set();
  variants.add(stripped); // original (may include +)

  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    variants.add(last10);                  // 7973944144
    variants.add('+91' + last10);          // +917973944144
    variants.add('91' + last10);           // 917973944144
    variants.add('0' + last10);            // 07973944144
  }
  // Also add the full digits string
  variants.add(digits);
  return Array.from(variants);
}

// GET /api/admin/patients - List all patients from MongoDB
router.get('/', async (req, res) => {
  try {
    const patients = await Patient.find({})
      .sort({ createdAt: -1 })
      .select('fullName name phone phoneNumber skinConcern planType startDate currentDay completionPercentage isActive totalPoints level createdAt coachName coachWhatsApp');

    res.json({
      success: true,
      count: patients.length,
      data: patients.map((p) => ({
        id: p._id,
        name: p.name || p.fullName,
        phone: p.phone || p.phoneNumber,
        skinConcern: p.skinConcern || '',
        planType: p.planType || 'Basic',
        startDate: p.startDate,
        currentDay: p.currentDay || 1,
        completionPercentage: p.completionPercentage || 0,
        isActive: p.isActive !== false,
        totalPoints: p.totalPoints || 0,
        level: p.level || 1,
        coachName: p.coachName || '',
        coachWhatsApp: p.coachWhatsApp || '',
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    console.error('Admin patients fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET /api/admin/patients/:phone/details - Full patient detail
router.get('/:phone/details', async (req, res) => {
  try {
    const { phone } = req.params;
    const phoneVariants = getPhoneVariants(phone);

    // Build $or conditions for all phone variants
    const patientOr = phoneVariants.flatMap(v => [{ phoneNumber: v }, { phone: v }]);
    const streakOr = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);
    const checkInOr = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);
    const skinScoreOr = phoneVariants.map(v => ({ phoneNumber: v }));

    // Try fetching Airtable with all phone variants (first match wins)
    const fetchAirtableWithVariants = async () => {
      for (const variant of phoneVariants) {
        try {
          const plans = await fetchDietPlans({ customerPhone: variant });
          if (plans && plans.length > 0) return plans;
        } catch (e) { /* continue */ }
      }
      return [];
    };

    const [patient, streak, checkIns, skinScores, airtablePlans] = await Promise.all([
      Patient.findOne({ $or: patientOr }).populate('dietPlan').populate('products'),
      Streak.findOne({ $or: streakOr }),
      DailyCheckIn.find({ $or: checkInOr }).sort({ date: -1 }).limit(90),
      SkinScore.find({ $or: skinScoreOr }).sort({ date: -1 }).limit(90),
      fetchAirtableWithVariants()
    ]);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Fetch reorder events
    let reorderEvents = [];
    try {
      reorderEvents = await ReorderEvent.find({
        $or: [
          { patientId: patient._id.toString() },
          { patientEmail: patient.email || '__none__' }
        ]
      }).sort({ timestamp: -1 }).limit(10);
    } catch (e) { /* ignore */ }

    const currentStreak = streak?.currentStreak || 0;
    const shields = Math.min(3, Math.floor(currentStreak / 7));

    // Days absent
    let daysAbsent = 0;
    if (streak?.lastCheckIn) {
      daysAbsent = Math.floor((new Date() - new Date(streak.lastCheckIn)) / (1000 * 60 * 60 * 24));
    }

    // Consistency — count unique days (multiple docs can exist per day; deduplicate by date)
    const toDateStr = d => new Date(d).toISOString().split('T')[0];
    const maxDay = patient.currentDay || 1;
    const completedDays = new Set(checkIns.filter(c => c.completed).map(c => toDateStr(c.date))).size;
    const overallConsistency = maxDay > 0 ? Math.min(100, Math.round((completedDays / maxDay) * 100)) : 0;

    // Sunscreen & Diet consistency
    const sunscreenDays = new Set(checkIns.filter(c => c.sunscreen).map(c => toDateStr(c.date))).size;
    const dietDays = new Set(checkIns.filter(c => c.dietFollowed === 'Yes' || c.dietFollowed === 'Partial').map(c => toDateStr(c.date))).size;
    const sunscreenConsistency = maxDay > 0 ? Math.min(100, Math.round((sunscreenDays / maxDay) * 100)) : 0;
    const dietConsistency = maxDay > 0 ? Math.min(100, Math.round((dietDays / maxDay) * 100)) : 0;

    // Plan end date
    let planEndDate = null;
    let daysRemaining = 0;
    if (patient.startDate) {
      const end = new Date(patient.startDate);
      end.setDate(end.getDate() + 90);
      planEndDate = end.toISOString().split('T')[0];
      daysRemaining = Math.max(0, Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24)));
    }

    // Weekly grid (Mon-Sun of current week)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + mondayOffset + i);
      d.setHours(0, 0, 0, 0);
      const dStr = d.toISOString().split('T')[0];
      const dayCheckIn = checkIns.find(c => {
        const cDate = new Date(c.date).toISOString().split('T')[0];
        return cDate === dStr;
      });
      weekDays.push({
        date: dStr,
        dayLabel: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
        completed: dayCheckIn ? dayCheckIn.completed : null,
        amCompleted: dayCheckIn ? (dayCheckIn.amRoutine || false) : null,
        pmCompleted: dayCheckIn ? (dayCheckIn.pmRoutine || false) : null,
        mood: dayCheckIn ? dayCheckIn.mood : null,
        isFuture: d > now
      });
    }

    // Skin score trajectory at key days
    const trajectoryDays = [1, 28, 56, 84];
    const skinTrajectory = trajectoryDays.map(day => {
      const score = skinScores.find(s => s.day === day);
      return { day, totalScore: score ? score.totalScore : null };
    });

    // Last 7 days moods
    const last7Moods = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const ci = checkIns.find(c => new Date(c.date).toISOString().split('T')[0] === dStr);
      last7Moods.push(ci ? ci.mood : null);
    }

    const bannerClicked = reorderEvents.length > 0;

    res.json({
      success: true,
      data: {
        patient: {
          id: patient._id,
          name: patient.name || patient.fullName,
          phone: patient.phone || patient.phoneNumber,
          email: patient.email || '',
          skinConcern: patient.skinConcern || '',
          planType: patient.planType || 'Basic',
          startDate: patient.startDate,
          currentDay: patient.currentDay || 1,
          completionPercentage: patient.completionPercentage || 0,
          isActive: patient.isActive !== false,
          totalPoints: patient.totalPoints || 0,
          level: patient.level || 1,
          achievements: patient.achievements || [],
          coachName: patient.coachName || '',
          coachWhatsApp: patient.coachWhatsApp || '',
          products: (patient.products || []).map(pr => ({
            id: pr._id,
            name: pr.name,
            category: pr.category,
            instructions: pr.instructions
          }))
        },
        dietPlan: airtablePlans.length > 0 ? airtablePlans[0] : null,
        streak: {
          currentStreak,
          longestStreak: streak?.longestStreak || 0,
          lastCheckIn: streak?.lastCheckIn || null,
          totalCheckIns: completedCheckIns,
          shields,
          daysAbsent
        },
        consistency: {
          overall: overallConsistency,
          sunscreen: sunscreenConsistency,
          diet: dietConsistency
        },
        reorder: {
          planEndDate,
          daysRemaining,
          bannerShown: maxDay >= 60,
          bannerClicked,
          newTreatmentPlan: false
        },
        weekGrid: weekDays,
        skinTrajectory,
        last7Moods,
        checkIns: checkIns.map(c => ({
          id: c._id,
          date: c.date,
          dayOfJourney: c.dayOfJourney,
          skinScore: c.skinScore,
          mood: c.mood,
          energy: c.energy,
          sleep: c.sleep,
          waterIntake: c.waterIntake,
          completed: c.completed,
          notes: c.notes || ''
        })),
        skinScores: skinScores.map(s => ({
          id: s._id,
          date: s.date,
          day: s.day,
          totalScore: s.totalScore
        }))
      }
    });
  } catch (error) {
    console.error('Admin patient details error:', error);
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

// PATCH /api/admin/patients/:phone/photos/:weekNumber/rating
// Save or update the coach rating and note for a weekly photo.
router.patch('/:phone/photos/:weekNumber/rating', async (req, res) => {
  try {
    const { phone, weekNumber } = req.params;
    const { coachRating, coachNote } = req.body;
    const week = parseInt(weekNumber, 10);

    if (!coachRating || coachRating < 1 || coachRating > 5) {
      return res.status(400).json({ error: 'coachRating must be 1–5' });
    }

    const phoneVariants = getPhoneVariants(phone);
    const query = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);

    const photo = await WeeklyPhoto.findOneAndUpdate(
      { $or: query, weekNumber: week },
      { coachRating, coachNote: coachNote || '', updatedAt: new Date() },
      { new: true }
    );

    if (!photo) {
      return res.status(404).json({ error: 'Weekly photo not found for this patient/week' });
    }

    res.json({ success: true, data: { weekNumber: photo.weekNumber, coachRating: photo.coachRating, coachNote: photo.coachNote } });
  } catch (error) {
    console.error('Photo rating update error:', error);
    res.status(500).json({ error: 'Failed to update photo rating' });
  }
});

module.exports = router;
