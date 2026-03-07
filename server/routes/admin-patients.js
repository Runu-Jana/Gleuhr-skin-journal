const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Streak = require('../models/Streak');
const DailyCheckIn = require('../models/DailyCheckIn');
const SkinScore = require('../models/SkinScore');
const { fetchDietPlans } = require('../services/airtableService');

// GET /api/admin/patients - List all patients from MongoDB
router.get('/', async (req, res) => {
  try {
    const patients = await Patient.find({})
      .sort({ createdAt: -1 })
      .select('fullName name phone phoneNumber skinConcern planType startDate currentDay completionPercentage isActive totalPoints level createdAt');

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
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    console.error('Admin patients fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET /api/admin/patients/:phone/details - Full patient detail with Airtable diet plan + streaks + check-ins + skin scores
router.get('/:phone/details', async (req, res) => {
  try {
    const { phone } = req.params;

    // Fetch all data in parallel: patient, streak, check-ins, skin scores, Airtable diet plan
    const [patient, streak, checkIns, skinScores, airtablePlans] = await Promise.all([
      Patient.findOne({
        $or: [{ phoneNumber: phone }, { phone: phone }]
      }).populate('dietPlan').populate('products'),

      Streak.findOne({
        $or: [{ patientPhone: phone }, { patientId: phone }]
      }),

      DailyCheckIn.find({
        $or: [{ patientPhone: phone }, { patientId: phone }]
      }).sort({ date: -1 }).limit(30),

      SkinScore.find({
        $or: [{ phoneNumber: phone }]
      }).sort({ date: -1 }).limit(30),

      fetchDietPlans({ customerPhone: phone }).catch(() => [])
    ]);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({
      success: true,
      data: {
        // Patient profile from MongoDB
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
          products: (patient.products || []).map((pr) => ({
            id: pr._id,
            name: pr.name,
            category: pr.category,
            instructions: pr.instructions
          }))
        },

        // Airtable diet plan (matched by phone)
        dietPlan: airtablePlans.length > 0 ? airtablePlans[0] : null,

        // Streak from MongoDB
        streak: streak ? {
          currentStreak: streak.currentStreak || 0,
          longestStreak: streak.longestStreak || 0,
          lastCheckIn: streak.lastCheckIn || null,
          totalCheckIns: (streak.checkInDates || []).filter((d) => d.completed).length
        } : { currentStreak: 0, longestStreak: 0, lastCheckIn: null, totalCheckIns: 0 },

        // Recent check-ins from MongoDB
        checkIns: checkIns.map((c) => ({
          id: c._id,
          date: c.date,
          dayOfJourney: c.dayOfJourney,
          skinScore: c.skinScore,
          mood: c.mood,
          energy: c.energy,
          sleep: c.sleep,
          waterIntake: c.waterIntake,
          completed: c.completed
        })),

        // Recent skin scores from MongoDB
        skinScores: skinScores.map((s) => ({
          id: s._id,
          date: s.date,
          day: s.day,
          totalScore: s.totalScore,
          texture: s.texture,
          pigmentation: s.pigmentation,
          brightness: s.brightness,
          breakouts: s.breakouts,
          hydration: s.hydration,
          glow: s.glow
        }))
      }
    });
  } catch (error) {
    console.error('Admin patient details error:', error);
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

module.exports = router;
