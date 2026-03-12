const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Streak = require('../models/Streak');
const DailyCheckIn = require('../models/DailyCheckIn');
const SkinScore = require('../models/SkinScore');
const WeeklyPhoto = require('../models/WeeklyPhoto');
const { fetchAllDietPlans, fetchDietPlans } = require('../services/airtableService');
const dieticianAuth = require('../middleware/dieticianAuth');

// Apply dietician auth to all routes
router.use(dieticianAuth);

/**
 * Build all phone number variants for MongoDB $or queries.
 */
function getPhoneVariants(phone) {
  if (!phone) return [];
  const digits = String(phone).replace(/[^\d]/g, '');
  const variants = new Set();
  variants.add(String(phone));
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

/**
 * GET /api/dietician/dashboard
 * Returns enriched patient queue for the logged-in dietician.
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dieticianName = req.dietician.name;
    const dieticianEmail = req.dietician.email;

    // 1. Fetch all Airtable diet plans and filter by dietician name (case-insensitive)
    const allPlans = await fetchAllDietPlans();
    const dietPlans = allPlans.filter(
      p => p.dieticianName && p.dieticianName.toLowerCase() === dieticianName.toLowerCase()
    );

    // 2. For each patient enrich with MongoDB data
    const enriched = await Promise.all(
      dietPlans.map(async (plan) => {
        const fullPhone = plan.fullPhone || plan.customerPhone;
        const phoneVariants = getPhoneVariants(fullPhone);

        if (phoneVariants.length === 0) {
          return {
            airtable: buildAirtableShape(plan),
            mongodb: null
          };
        }

        const patientOr = phoneVariants.flatMap(v => [{ phoneNumber: v }, { phone: v }]);
        const streakOr = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);
        const ciOr = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);

        const [patient, streak, recentCheckIns14, last7CheckIns] = await Promise.all([
          Patient.findOne({ $or: patientOr }).lean(),
          Streak.findOne({ $or: streakOr }).lean(),
          DailyCheckIn.find({ $or: ciOr }).sort({ date: -1 }).limit(14).lean(),
          DailyCheckIn.find({ $or: ciOr }).sort({ date: -1 }).limit(7).lean(),
        ]);

        if (!patient) {
          return {
            airtable: buildAirtableShape(plan),
            mongodb: null
          };
        }

        // Days absent since last check-in
        let daysAbsent = 0;
        if (streak?.lastCheckIn) {
          daysAbsent = Math.floor((new Date() - new Date(streak.lastCheckIn)) / (1000 * 60 * 60 * 24));
        }

        const currentDay = patient.currentDay || 1;

        // Consistency from last 7 check-ins
        const last7 = last7CheckIns;
        const overallCompleted = last7.filter(c => c.completed).length;
        const sunscreenCount = last7.filter(c => c.sunscreen).length;
        const dietCount = last7.filter(c => c.dietFollowed === 'Yes' || c.dietFollowed === 'Partial').length;
        const total7 = 7;

        const consistency = {
          overall: Math.round((overallCompleted / total7) * 100),
          sunscreen: Math.round((sunscreenCount / total7) * 100),
          diet: Math.round((dietCount / total7) * 100),
        };

        return {
          airtable: buildAirtableShape(plan),
          mongodb: {
            patientId: patient._id,
            name: patient.name || patient.fullName,
            currentDay,
            streak: {
              currentStreak: streak?.currentStreak || 0,
              longestStreak: streak?.longestStreak || 0,
            },
            consistency,
            daysAbsent,
          }
        };
      })
    );

    // 3. Categorize into queue sections
    const urgent = [];
    const scheduledCalls = [];
    const reorder = [];
    const flagged = [];
    const airtableOnly = [];

    for (const item of enriched) {
      if (!item.mongodb) {
        airtableOnly.push({ ...item, reason: 'Not in App', action: 'Verify registration' });
        continue;
      }

      const { daysAbsent, currentDay, consistency } = item.mongodb;
      let categorized = false;

      // Urgent: 7+ days absent
      if (daysAbsent >= 7) {
        urgent.push({ ...item, reason: '7 Days Absent', action: 'Phone call required' });
        categorized = true;
      } else if (daysAbsent >= 2) {
        urgent.push({ ...item, reason: `${daysAbsent} Days Missed`, action: 'Personal check-in' });
        categorized = true;
      }

      // Scheduled calls: new patient (day <= 3)
      if (currentDay <= 3) {
        scheduledCalls.push({ ...item, reason: 'New Patient', action: 'Introduction call' });
        categorized = true;
      }

      // Reorder: day 30-45
      if (currentDay >= 30 && currentDay <= 45) {
        reorder.push({ ...item, reason: 'Reorder Window', action: 'Reorder conversation' });
        categorized = true;
      }

      // Flagged: consistency issues
      if (consistency.sunscreen < 65) {
        flagged.push({ ...item, reason: 'Sunscreen Skipping', action: 'Discuss sunscreen barrier' });
        categorized = true;
      } else if (consistency.diet < 65) {
        flagged.push({ ...item, reason: 'Diet Struggling', action: 'Discuss diet swaps' });
        categorized = true;
      } else if (consistency.overall < 65 && currentDay > 7) {
        flagged.push({ ...item, reason: 'Consistency Declining', action: 'Diagnose drop-off' });
        categorized = true;
      }
    }

    // 4. Compute stats
    const callPendingStatuses = ['Call Pending', 'Pending'];
    const callsToday = [
      ...urgent.filter(i => callPendingStatuses.includes(i.airtable.dieticianCallStatus)),
      ...scheduledCalls.filter(i => callPendingStatuses.includes(i.airtable.dieticianCallStatus)),
      ...airtableOnly.filter(i => callPendingStatuses.includes(i.airtable.dieticianCallStatus)),
    ].length;

    const inAppPatients = enriched.filter(i => i.mongodb !== null);
    const avgConsistency = inAppPatients.length > 0
      ? Math.round(inAppPatients.reduce((sum, i) => sum + (i.mongodb.consistency.overall || 0), 0) / inAppPatients.length)
      : 0;

    // Greeting based on time of day
    const hour = new Date().getHours();
    let greetingTime = 'Good morning';
    if (hour >= 12 && hour < 17) greetingTime = 'Good afternoon';
    else if (hour >= 17) greetingTime = 'Good evening';
    const greeting = `${greetingTime}, ${dieticianName.split(' ')[0]}!`;

    res.json({
      success: true,
      data: {
        greeting,
        dietician: { name: dieticianName, email: dieticianEmail },
        stats: {
          needAttention: urgent.length,
          callsToday,
          avgConsistency,
          reorderDue: reorder.length,
        },
        queue: {
          urgent,
          flagged,
          scheduledCalls,
          reorder,
          airtableOnly,
        },
        totalCount: dietPlans.length,
        inAppCount: inAppPatients.length,
      }
    });
  } catch (error) {
    console.error('Dietician dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

/**
 * GET /api/dietician/patient/:phone/details
 * Full patient detail view for a specific patient.
 */
router.get('/patient/:phone/details', async (req, res) => {
  try {
    const { phone } = req.params;
    const phoneVariants = getPhoneVariants(phone);

    const patientOr = phoneVariants.flatMap(v => [{ phoneNumber: v }, { phone: v }]);
    const streakOr = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);
    const checkInOr = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);
    const skinScoreOr = phoneVariants.map(v => ({ phoneNumber: v }));

    // Fetch Airtable with phone variants
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
      Patient.findOne({ $or: patientOr }).populate('products').lean(),
      Streak.findOne({ $or: streakOr }).lean(),
      DailyCheckIn.find({ $or: checkInOr }).sort({ date: -1 }).limit(90).lean(),
      SkinScore.find({ $or: skinScoreOr }).sort({ date: -1 }).limit(90).lean(),
      fetchAirtableWithVariants(),
    ]);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const currentStreak = streak?.currentStreak || 0;
    const shields = Math.min(3, Math.floor(currentStreak / 7));

    let daysAbsent = 0;
    if (streak?.lastCheckIn) {
      daysAbsent = Math.floor((new Date() - new Date(streak.lastCheckIn)) / (1000 * 60 * 60 * 24));
    }

    // Consistency calculations
    const completedCheckIns = checkIns.filter(c => c.completed).length;
    const maxDay = patient.currentDay || 1;
    const overallConsistency = maxDay > 0 ? Math.round((completedCheckIns / maxDay) * 100) : 0;
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
        amCompleted: dayCheckIn ? (dayCheckIn.amRoutine || false) : null,
        pmCompleted: dayCheckIn ? (dayCheckIn.pmRoutine || false) : null,
        mood: dayCheckIn ? dayCheckIn.mood : null,
        isFuture: d > now,
      });
    }

    // Skin score trajectory at key days
    const trajectoryDays = [1, 28, 56, 84];
    const skinTrajectory = trajectoryDays.map(day => {
      const score = skinScores.find(s => s.day === day);
      return { day, totalScore: score ? score.totalScore : null };
    });

    // Last 7 moods
    const last7Moods = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const ci = checkIns.find(c => new Date(c.date).toISOString().split('T')[0] === dStr);
      last7Moods.push(ci ? ci.mood : null);
    }

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
          products: (patient.products || []).map(pr => ({
            id: pr._id,
            name: pr.name,
            category: pr.category,
            instructions: pr.instructions,
          })),
        },
        dietPlan: airtablePlans.length > 0 ? airtablePlans[0] : null,
        streak: {
          currentStreak,
          longestStreak: streak?.longestStreak || 0,
          lastCheckIn: streak?.lastCheckIn || null,
          totalCheckIns: completedCheckIns,
          shields,
          daysAbsent,
        },
        consistency: {
          overall: overallConsistency,
          sunscreen: sunscreenConsistency,
          diet: dietConsistency,
        },
        reorder: {
          planEndDate,
          daysRemaining,
        },
        weekGrid: weekDays,
        skinTrajectory,
        last7Moods,
      }
    });
  } catch (error) {
    console.error('Dietician patient details error:', error);
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

function buildAirtableShape(plan) {
  return {
    id: plan.id,
    customerName: plan.customerName,
    customerPhone: plan.customerPhone,
    dialCode: plan.dialCode,
    treatmentPlan: plan.treatmentPlan,
    dieticianCallStatus: plan.dieticianCallStatus,
    dietPlanStatus: plan.dietPlanStatus,
    dietPlanDueDate: plan.dietPlanDate,
  };
}

module.exports = router;
