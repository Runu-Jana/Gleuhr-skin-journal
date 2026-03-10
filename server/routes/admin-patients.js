const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Streak = require('../models/Streak');
const DailyCheckIn = require('../models/DailyCheckIn');
const SkinScore = require('../models/SkinScore');
const ReorderEvent = require('../models/ReorderEvent');
const { fetchDietPlans } = require('../services/airtableService');

/**
 * Normalize a phone number and return all possible format variants.
 */
function getPhoneVariants(phone) {
  if (!phone) return [];
  const stripped = phone.replace(/[\s\-\(\)]/g, '');
  const digits = stripped.replace(/[^\d]/g, '');
  const variants = new Set();
  variants.add(stripped);
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    variants.add(last10);
    variants.add('+91' + last10);
    variants.add('91' + last10);
    variants.add('0' + last10);
  }
  variants.add(digits);
  return Array.from(variants);
}

/** Get last 10 digits of a phone for matching */
function normPhone(phone) {
  if (!phone) return '';
  return phone.replace(/[^\d]/g, '').slice(-10);
}

// ─── GET /api/admin/patients/queue ────────────────────────────
// Fetches all Airtable diet plans, matches with MongoDB, categorizes
router.get('/queue', async (req, res) => {
  try {
    const { dietician } = req.query;

    // 1. Fetch ALL Airtable diet plans
    const allPlans = await fetchDietPlans({});

    // 2. Get unique dietician names for sidebar
    const dieticians = [...new Set(allPlans.map(p => p.dieticianName).filter(Boolean))];

    // 3. Filter by selected dietician (if provided)
    const plans = dietician
      ? allPlans.filter(p => p.dieticianName === dietician)
      : allPlans;

    if (plans.length === 0) {
      return res.json({
        success: true,
        data: {
          dieticians,
          selectedDietician: dietician || null,
          summary: { activePatients: 0, needAttention: 0, callsToday: 0, avgConsistency: 0, reorderDue: 0 },
          categories: { urgent: [], flagged: [], scheduledCalls: [], reorder: [] },
          allPatients: [],
          onboarding: []
        }
      });
    }

    // 4. Batch fetch all MongoDB data
    const allPatients = await Patient.find({}).lean();
    const allStreaks = await Streak.find({}).lean();

    // Last 14 days for recent check-in analysis
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const recentCheckIns = await DailyCheckIn.find({ date: { $gte: fourteenDaysAgo } }).lean();

    // All check-ins for overall consistency
    const allCheckIns = await DailyCheckIn.find({}).lean();

    // Build lookup maps using normalized phone (last 10 digits)
    const patientMap = {};
    allPatients.forEach(p => {
      const key = normPhone(p.phone || p.phoneNumber);
      if (key) patientMap[key] = p;
    });

    const streakMap = {};
    allStreaks.forEach(s => {
      const key = normPhone(s.patientPhone || s.patientId);
      if (key) streakMap[key] = s;
    });

    const checkInMap = {};
    allCheckIns.forEach(c => {
      const key = normPhone(c.patientPhone || c.patientId);
      if (!checkInMap[key]) checkInMap[key] = [];
      checkInMap[key].push(c);
    });

    const recentCheckInMap = {};
    recentCheckIns.forEach(c => {
      const key = normPhone(c.patientPhone || c.patientId);
      if (!recentCheckInMap[key]) recentCheckInMap[key] = [];
      recentCheckInMap[key].push(c);
    });

    // 5. Match Airtable plans with MongoDB data and categorize
    const now = new Date();
    const enrichedPatients = [];

    for (const plan of plans) {
      const phoneKey = normPhone(plan.customerPhone);
      if (!phoneKey) continue;

      const patient = patientMap[phoneKey];
      if (!patient) continue; // Skip if no MongoDB record

      const streak = streakMap[phoneKey];
      const patientCheckIns = checkInMap[phoneKey] || [];
      const recent = recentCheckInMap[phoneKey] || [];

      const currentDay = patient.currentDay || 1;
      const currentStreak = streak?.currentStreak || 0;
      const completedCheckIns = patientCheckIns.filter(c => c.completed).length;
      const consistency = currentDay > 0 ? Math.round((completedCheckIns / currentDay) * 100) : 0;

      // Days absent
      let daysAbsent = 0;
      if (streak?.lastCheckIn) {
        daysAbsent = Math.floor((now - new Date(streak.lastCheckIn)) / (1000 * 60 * 60 * 24));
      } else if (patientCheckIns.length === 0) {
        daysAbsent = currentDay;
      }

      // Recent sunscreen/diet compliance (last 14 days)
      const recentSunscreen = recent.filter(c => c.sunscreen).length;
      const recentDiet = recent.filter(c => c.dietFollowed === 'Yes' || c.dietFollowed === 'Partial').length;
      const recentTotal = recent.length || 1;
      const sunscreenRate = Math.round((recentSunscreen / recentTotal) * 100);
      const dietRate = Math.round((recentDiet / recentTotal) * 100);

      // Weekly photo check
      const lastPhotoDay = Math.floor(currentDay / 7) * 7;
      const photoMissed = currentDay > 7 && (currentDay - lastPhotoDay) > 3; // simplified

      // Reorder window
      let daysRemaining = 0;
      if (patient.startDate) {
        const end = new Date(patient.startDate);
        end.setDate(end.getDate() + 90);
        daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
      }
      const inReorderWindow = currentDay >= 25 || daysRemaining <= 65;

      // Categorize
      let category = 'all';
      let flag = null;
      let flagColor = '#888';
      let actionNeeded = '';

      if (daysAbsent >= 7) {
        category = 'urgent';
        flag = `${daysAbsent} Days Absent`;
        flagColor = '#DC2626';
        actionNeeded = 'Phone call required';
      } else if (daysAbsent >= 2) {
        category = 'urgent';
        flag = `${daysAbsent} Days Missed`;
        flagColor = '#DC2626';
        actionNeeded = 'Personal check-in';
      } else if (!patient.isActive || patient.isActive === false) {
        category = 'urgent';
        flag = 'On Hold';
        flagColor = '#CA8A04';
        actionNeeded = 'Check in gently';
      } else if (sunscreenRate < 40 && currentDay > 7) {
        category = 'flagged';
        flag = 'Sunscreen Skipping';
        flagColor = '#CA8A04';
        actionNeeded = 'Discuss sunscreen barrier';
      } else if (dietRate < 40 && currentDay > 7) {
        category = 'flagged';
        flag = 'Diet Struggling';
        flagColor = '#CA8A04';
        actionNeeded = 'Discuss diet swaps';
      } else if (consistency < 50 && currentDay > 14) {
        category = 'flagged';
        flag = 'Consistency Declining';
        flagColor = '#CA8A04';
        actionNeeded = 'Diagnose drop-off';
      } else if (photoMissed) {
        category = 'flagged';
        flag = 'Photo Missed';
        flagColor = '#CA8A04';
        actionNeeded = 'Remind weekly photo';
      } else if (currentDay <= 3) {
        category = 'scheduledCalls';
        flag = 'New Patient';
        flagColor = '#16A34A';
        actionNeeded = 'Introduction call';
      } else if (inReorderWindow) {
        category = 'reorder';
        flag = 'Reorder Window';
        flagColor = '#16A34A';
        actionNeeded = 'Reorder conversation';
      }

      // TP-ID from Airtable record ID
      const tpId = plan.id ? `TP-${plan.id.slice(-4).toUpperCase()}` : '';

      enrichedPatients.push({
        id: patient._id,
        name: patient.name || patient.fullName || plan.customerName,
        phone: patient.phone || patient.phoneNumber,
        tpId,
        currentDay,
        consistency,
        streak: currentStreak,
        isActive: patient.isActive !== false,
        daysAbsent,
        skinConcern: patient.skinConcern || '',
        coachName: patient.coachName || '',
        dieticianName: plan.dieticianName || '',
        planCategory: plan.planCategory || '',
        startDate: patient.startDate,
        category,
        flag,
        flagColor,
        actionNeeded
      });
    }

    // Group by category
    const urgent = enrichedPatients.filter(p => p.category === 'urgent');
    const flagged = enrichedPatients.filter(p => p.category === 'flagged');
    const scheduledCalls = enrichedPatients.filter(p => p.category === 'scheduledCalls');
    const reorder = enrichedPatients.filter(p => p.category === 'reorder');
    const onboarding = enrichedPatients.filter(p => p.currentDay <= 3);

    // Summary
    const active = enrichedPatients.filter(p => p.isActive);
    const avgConsistency = active.length > 0
      ? Math.round(active.reduce((s, p) => s + p.consistency, 0) / active.length)
      : 0;

    res.json({
      success: true,
      data: {
        dieticians,
        selectedDietician: dietician || null,
        summary: {
          activePatients: active.length,
          needAttention: urgent.length,
          callsToday: scheduledCalls.length,
          avgConsistency,
          reorderDue: reorder.length
        },
        categories: { urgent, flagged, scheduledCalls, reorder },
        allPatients: enrichedPatients,
        onboarding
      }
    });
  } catch (error) {
    console.error('Admin queue error:', error);
    res.status(500).json({ error: 'Failed to fetch queue data' });
  }
});

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

    // Consistency
    const completedCheckIns = checkIns.filter(c => c.completed).length;
    const maxDay = patient.currentDay || 1;
    const overallConsistency = maxDay > 0 ? Math.round((completedCheckIns / maxDay) * 100) : 0;

    // Sunscreen & Diet consistency
    const sunscreenCount = checkIns.filter(c => c.sunscreen).length;
    const dietCount = checkIns.filter(c => c.dietFollowed === 'Yes' || c.dietFollowed === 'Partial').length;
    const sunscreenConsistency = maxDay > 0 ? Math.round((sunscreenCount / maxDay) * 100) : 0;
    const dietConsistency = maxDay > 0 ? Math.round((dietCount / maxDay) * 100) : 0;

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

module.exports = router;
