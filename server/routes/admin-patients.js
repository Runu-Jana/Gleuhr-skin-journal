const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Streak = require('../models/Streak');
const DailyCheckIn = require('../models/DailyCheckIn');
const SkinScore = require('../models/SkinScore');
const ReorderEvent = require('../models/ReorderEvent');
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

// GET /api/admin/patients/:phone/details - Full patient detail
router.get('/:phone/details', async (req, res) => {
  try {
    const { phone } = req.params;

    const [patient, streak, checkIns, skinScores, airtablePlans] = await Promise.all([
      Patient.findOne({
        $or: [{ phoneNumber: phone }, { phone: phone }]
      }).populate('dietPlan').populate('products'),

      Streak.findOne({
        $or: [{ patientPhone: phone }, { patientId: phone }]
      }),

      DailyCheckIn.find({
        $or: [{ patientPhone: phone }, { patientId: phone }]
      }).sort({ date: -1 }).limit(90),

      SkinScore.find({
        $or: [{ phoneNumber: phone }]
      }).sort({ date: -1 }).limit(90),

      fetchDietPlans({ customerPhone: phone }).catch(() => [])
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

    // Consistency
    const completedCheckIns = checkIns.filter(c => c.completed).length;
    const maxDay = patient.currentDay || 1;
    const overallConsistency = maxDay > 0 ? Math.round((completedCheckIns / maxDay) * 100) : 0;

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
          sunscreen: 0,
          diet: 0
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

module.exports = router;
