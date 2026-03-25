const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Streak = require('../models/Streak');
const DailyCheckIn = require('../models/DailyCheckIn');
const SkinScore = require('../models/SkinScore');
const WeeklyPhoto = require('../models/WeeklyPhoto');
const CoachNote = require('../models/CoachNote');
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

        // Consistency from last 7 days — use unique days to handle duplicate docs
        const toDateStr7 = d => new Date(d).toISOString().split('T')[0];
        const last7 = last7CheckIns;
        const overallDays = new Set(last7.filter(c => c.completed).map(c => toDateStr7(c.date))).size;
        const sunscreenDays7 = new Set(last7.filter(c => c.sunscreen).map(c => toDateStr7(c.date))).size;
        const dietDays7 = new Set(last7.filter(c => c.dietFollowed === 'Yes' || c.dietFollowed === 'Partial').map(c => toDateStr7(c.date))).size;
        const total7 = 7;

        const consistency = {
          overall: Math.min(100, Math.round((overallDays / total7) * 100)),
          sunscreen: Math.min(100, Math.round((sunscreenDays7 / total7) * 100)),
          diet: Math.min(100, Math.round((dietDays7 / total7) * 100)),
        };

        return {
          airtable: buildAirtableShape(plan),
          mongodb: {
            patientId: patient._id,
            name: plan.customerName || patient.name || patient.fullName,
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

      // Reorder: day 25-35 (products last ~40 days, need 5-7 days shipping buffer)
      if (currentDay >= 25 && currentDay <= 35) {
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

    const onboardingPatients = enriched.filter(
      item => !item.mongodb || (item.mongodb.currentDay <= 7)
    );

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
        allPatients: enriched,
        onboardingCount: onboardingPatients.length,
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
      // Patient not in MongoDB — return Airtable-only data so the UI can still show details
      const airtablePlan = airtablePlans.length > 0 ? airtablePlans[0] : null;
      return res.json({
        success: true,
        data: {
          airtableOnly: true,
          patient: {
            id: null,
            name: airtablePlan?.customerName || 'Unknown',
            phone: airtablePlan?.fullPhone || airtablePlan?.customerPhone || phone,
            email: '',
            skinConcern: '',
            planType: '',
            startDate: null,
            currentDay: null,
            totalPoints: 0,
            level: 1,
            products: [],
          },
          dietPlan: airtablePlan,
          streak: null,
          consistency: null,
          reorder: { planEndDate: null, daysRemaining: 0 },
          weekGrid: [],
          skinTrajectory: [],
          last7Moods: [],
        }
      });
    }

    const currentStreak = streak?.currentStreak || 0;
    const shields = Math.min(3, Math.floor(currentStreak / 7));

    let daysAbsent = 0;
    if (streak?.lastCheckIn) {
      daysAbsent = Math.floor((new Date() - new Date(streak.lastCheckIn)) / (1000 * 60 * 60 * 24));
    }

    // Consistency calculations — use unique days to avoid >100% from duplicate docs
    const toDateStr = d => new Date(d).toISOString().split('T')[0];
    const maxDay = patient.currentDay || 1;
    const completedDays = new Set(checkIns.filter(c => c.completed).map(c => toDateStr(c.date))).size;
    const overallConsistency = maxDay > 0 ? Math.min(100, Math.round((completedDays / maxDay) * 100)) : 0;
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
          name: (airtablePlans.length > 0 && airtablePlans[0].customerName) ? airtablePlans[0].customerName : (patient.name || patient.fullName),
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

/**
 * GET /api/dietician/patient/:phone/diet
 * Diet & Compliance data: plan history, trigger foods, water intake, compliance %.
 */
router.get('/patient/:phone/diet', async (req, res) => {
  try {
    const { phone } = req.params;
    const phoneVariants = getPhoneVariants(phone);
    const patientOr  = phoneVariants.flatMap(v => [{ phoneNumber: v }, { phone: v }]);
    const checkInOr  = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);

    const [patient, checkIns14] = await Promise.all([
      Patient.findOne({ $or: patientOr }).populate('dietPlan').lean(),
      DailyCheckIn.find({ $or: checkInOr }).sort({ date: -1 }).limit(14).lean(),
    ]);

    // Trigger food frequency (last 14 days)
    const foodCount = {};
    checkIns14.forEach(c => {
      (c.triggerFoods || []).forEach(food => {
        if (food) foodCount[food] = (foodCount[food] || 0) + 1;
      });
    });
    const triggerFoodFrequency = Object.entries(foodCount)
      .map(([food, days]) => ({ food, days }))
      .sort((a, b) => b.days - a.days);

    // Water intake distribution — saved as 1/2/3/4 (< 1L, 1-2L, 2-3L, 3L+)
    const waterBuckets = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let waterTotal = 0, waterCount = 0;
    checkIns14.forEach(c => {
      if (c.waterIntake >= 1 && c.waterIntake <= 4) {
        waterBuckets[c.waterIntake]++;
        waterTotal += c.waterIntake;
        waterCount++;
      }
    });
    const waterAvg = waterCount > 0 ? Math.round(waterTotal / waterCount) : 0;

    // Diet compliance — Yes = 1.0, Partial = 0.5, No = 0
    const daysWithData = checkIns14.filter(c => c.dietFollowed && c.dietFollowed !== 'skipped').length;
    const dietScore = checkIns14.reduce((sum, c) => {
      if (c.dietFollowed === 'Yes') return sum + 1;
      if (c.dietFollowed === 'Partial') return sum + 0.5;
      return sum;
    }, 0);
    const dietCompliance = daysWithData > 0 ? Math.round((dietScore / daysWithData) * 100) : 0;

    // Diet plan history: past versions (oldest → newest) + current active plan
    let dietPlanHistory = [];
    if (patient?.dietPlan) {
      const dp = patient.dietPlan;
      const pastVersions = (dp.versions || []).map((v, i) => ({
        version: `v${i + 1}`,
        category: v.category || '',
        restrictions: v.restrictions || [],
        notes: v.notes || '',
        isActive: false,
        createdAt: v.createdAt,
      }));
      const currentVersion = {
        version: `v${pastVersions.length + 1}`,
        category: dp.category || 'Standard',
        restrictions: dp.restrictions || [],
        notes: dp.notes || '',
        isActive: dp.isActive !== false,
        createdAt: dp.updatedAt || dp.createdAt,
      };
      dietPlanHistory = [...pastVersions, currentVersion];
    }

    res.json({
      success: true,
      data: { dietPlanHistory, triggerFoodFrequency, waterIntake: { buckets: waterBuckets, average: waterAvg }, dietCompliance },
    });
  } catch (error) {
    console.error('Dietician patient diet error:', error);
    res.status(500).json({ error: 'Failed to fetch diet data' });
  }
});

/**
 * POST /api/dietician/patient/:phone/diet-plan
 * Add a new diet plan version for a patient.
 * Body: { category, restrictions, notes }
 */
const DietPlan = require('../models/DietPlan');
router.post('/patient/:phone/diet-plan', async (req, res) => {
  try {
    const { phone } = req.params;
    const { category, restrictions, notes } = req.body;
    const phoneVariants = getPhoneVariants(phone);
    const patientOr = phoneVariants.flatMap(v => [{ phoneNumber: v }, { phone: v }]);

    const patient = await Patient.findOne({ $or: patientOr }).populate('dietPlan');
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (patient.dietPlan) {
      // Archive the current plan into the versions history, then update with new values
      const dp = patient.dietPlan;
      await DietPlan.findByIdAndUpdate(dp._id, {
        $push: {
          versions: {
            category: dp.category,
            restrictions: dp.restrictions || [],
            notes: dp.notes || '',
            createdAt: dp.updatedAt || dp.createdAt || new Date(),
          }
        },
        category: category || dp.category,
        restrictions: restrictions || [],
        notes: notes || '',
        updatedAt: new Date(),
      });
    } else {
      // First-time diet plan for this patient
      const newPlan = new DietPlan({
        version: 'v1',
        category: category || 'General',
        restrictions: restrictions || [],
        notes: notes || '',
      });
      await newPlan.save();
      await Patient.findByIdAndUpdate(patient._id, { dietPlan: newPlan._id });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Save diet plan error:', error);
    res.status(500).json({ error: 'Failed to save diet plan' });
  }
});

/**
 * GET /api/dietician/patient/:phone/notes
 * Return all coach notes for a patient (newest first).
 */
router.get('/patient/:phone/notes', async (req, res) => {
  try {
    const phoneVariants = getPhoneVariants(req.params.phone);
    const notes = await CoachNote.find({ patientPhone: { $in: phoneVariants } })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, notes });
  } catch (err) {
    console.error('Fetch notes error:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

/**
 * POST /api/dietician/patient/:phone/notes
 * Save a new coach note for a patient.
 */
router.post('/patient/:phone/notes', async (req, res) => {
  try {
    const { note } = req.body;
    if (!note || !note.trim()) return res.status(400).json({ error: 'Note is empty' });
    const saved = await CoachNote.create({
      patientPhone: req.params.phone,
      dieticianName: req.dietician?.name || '',
      note: note.trim(),
    });
    res.json({ success: true, note: saved });
  } catch (err) {
    console.error('Save note error:', err);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

/**
 * POST /api/dietician/patient/:phone/restore-shield
 * Coach restores one shield for a patient (max 2 coach-restorations per month).
 */
router.post('/patient/:phone/restore-shield', async (req, res) => {
  try {
    const phoneVariants = getPhoneVariants(req.params.phone);
    const patientOr = phoneVariants.flatMap(v => [{ phoneNumber: v }, { phone: v }]);
    const streakOr  = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);

    const [patient, streak] = await Promise.all([
      Patient.findOne({ $or: patientOr }),
      Streak.findOne({ $or: streakOr }),
    ]);

    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    if (!streak)  return res.status(404).json({ error: 'No streak data found' });

    const currentMonth = new Date().toISOString().slice(0, 7);

    // Track coach restorations separately (max 2/month)
    const coachShields = streak.coachShields || { used: 0, lastResetMonth: currentMonth };
    if (coachShields.lastResetMonth !== currentMonth) {
      coachShields.used = 0;
      coachShields.lastResetMonth = currentMonth;
    }
    if (coachShields.used >= 2) {
      return res.status(400).json({ error: 'Maximum 2 coach shield restorations used this month for this patient' });
    }

    // Add 1 to the player's available shields (cap at 3 total auto + 2 coach = 5 total possible)
    const currentAvailable = streak.shields?.monthly != null
      ? (streak.shields.monthly - (streak.shields.used || 0))
      : 3;

    await Streak.findByIdAndUpdate(streak._id, {
      'shields.monthly': Math.min(5, (streak.shields?.monthly || 3) + 1),
      coachShields: { used: coachShields.used + 1, lastResetMonth: currentMonth },
    });

    res.json({
      success: true,
      message: 'Shield restored for patient',
      coachRestorations: { used: coachShields.used + 1, remaining: 2 - (coachShields.used + 1) },
    });
  } catch (err) {
    console.error('Coach restore shield error:', err);
    res.status(500).json({ error: 'Failed to restore shield' });
  }
});

/**
 * POST /api/dietician/patient/:phone/photo-rating
 * Coach saves a 1-5 improvement rating for a patient's weekly photo.
 */
router.post('/patient/:phone/photo-rating', async (req, res) => {
  try {
    const { weekNumber, rating, note } = req.body;
    if (!weekNumber || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'weekNumber and rating (1-5) are required' });
    }
    const phoneVariants = getPhoneVariants(req.params.phone);
    const photoOr = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);

    const updated = await WeeklyPhoto.findOneAndUpdate(
      { $or: photoOr, weekNumber: Number(weekNumber) },
      { coachRating: Number(rating), coachNote: note || '' },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Photo not found for that week' });

    res.json({ success: true, photo: { weekNumber: updated.weekNumber, coachRating: updated.coachRating, coachNote: updated.coachNote } });
  } catch (err) {
    console.error('Coach photo rating error:', err);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

/**
 * GET /api/dietician/patient/:phone/photos
 * Return weekly photos with coach ratings for a patient.
 */
router.get('/patient/:phone/photos', async (req, res) => {
  try {
    const phoneVariants = getPhoneVariants(req.params.phone);
    const photoOr = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);
    const photos = await WeeklyPhoto.find({ $or: photoOr })
      .sort({ weekNumber: 1 })
      .select('weekNumber dayOfJourney uploadDate photoUrl photoData coachRating coachNote')
      .lean();
    res.json({
      success: true,
      photos: photos.map(p => ({
        weekNumber: p.weekNumber,
        dayOfJourney: p.dayOfJourney,
        uploadDate: p.uploadDate,
        // Prefer Airtable URL (stable); fall back to base64 data-URI
        photoUrl: p.photoUrl || p.photoData || '',
        coachRating: p.coachRating ?? null,
        coachNote: p.coachNote || '',
      })),
    });
  } catch (err) {
    console.error('Fetch photos error:', err);
    res.status(500).json({ error: 'Failed to fetch photos' });
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
    products: plan.products || [],
  };
}

module.exports = router;
