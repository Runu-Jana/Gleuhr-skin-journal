const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Streak = require('../models/Streak');
const DailyCheckIn = require('../models/DailyCheckIn');
const SkinScore = require('../models/SkinScore');
const WeeklyPhoto = require('../models/WeeklyPhoto');
const { fetchAllDietPlans } = require('../services/airtableService');

/**
 * Build all phone number variants for MongoDB $or queries.
 * Handles: +917973944144, 917973944144, 7973944144, etc.
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
 * Normalize phone for comparison (strip country code and non-digits).
 */
function normalizePhone(phone) {
  return String(phone || '').replace(/^\+?91/, '').replace(/[^\d]/g, '');
}

/**
 * GET /api/admin/dietician
 * Returns list of all unique dietician names from Airtable.
 * Use to populate a dietician selector on the admin dashboard.
 */
router.get('/', async (req, res) => {
  try {
    const allPlans = await fetchAllDietPlans();
    const nameSet = new Set();
    allPlans.forEach(plan => {
      if (plan.dieticianName) nameSet.add(plan.dieticianName);
    });
    const dieticians = Array.from(nameSet).sort();
    res.json({ success: true, count: dieticians.length, data: dieticians });
  } catch (error) {
    console.error('Dietician list error:', error);
    res.status(500).json({ error: 'Failed to fetch dieticians' });
  }
});

/**
 * GET /api/admin/dietician/:name/customers
 * Returns all customers assigned to a dietician from Airtable,
 * enriched with their MongoDB data (streak, check-ins, skin scores,
 * weekly photos, products) where available.
 *
 * Query params:
 *   - inApp=true   only return customers who have logged in (exist in MongoDB)
 */
router.get('/:name/customers', async (req, res) => {
  try {
    const { name } = req.params;
    const onlyInApp = req.query.inApp === 'true';

    // 1. Fetch all Airtable diet plans and filter by dietician name (case-insensitive)
    const allPlans = await fetchAllDietPlans();
    const dietPlans = allPlans.filter(
      p => p.dieticianName && p.dieticianName.toLowerCase() === name.toLowerCase()
    );

    if (dietPlans.length === 0) {
      return res.json({ success: true, dieticianName: name, count: 0, data: [] });
    }

    // 2. For each customer, look up MongoDB data in parallel
    const results = await Promise.all(
      dietPlans.map(async (plan) => {
        // Build full phone: dialCode + phoneNumber (e.g., "91" + "8872218317" = "918872218317")
        const fullPhone = plan.fullPhone || plan.customerPhone;
        const phoneVariants = getPhoneVariants(fullPhone);

        if (phoneVariants.length === 0) {
          return onlyInApp ? null : { airtable: plan, mongodb: null };
        }

        const patientOr = phoneVariants.flatMap(v => [{ phoneNumber: v }, { phone: v }]);
        const streakOr  = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);
        const ciOr      = phoneVariants.flatMap(v => [{ patientPhone: v }, { patientId: v }]);
        const ssOr      = phoneVariants.map(v => ({ phoneNumber: v }));

        const [patient, streak, recentCheckIns, skinScores] = await Promise.all([
          Patient.findOne({ $or: patientOr }).populate('products').lean(),
          Streak.findOne({ $or: streakOr }).lean(),
          DailyCheckIn.find({ $or: ciOr }).sort({ date: -1 }).limit(7).lean(),
          SkinScore.find({ $or: ssOr }).sort({ date: -1 }).limit(10).lean(),
        ]);

        if (onlyInApp && !patient) return null;

        // Weekly photos — only if patient exists (need patientId or patientPhone)
        let weeklyPhotos = [];
        if (patient) {
          const photoOr = phoneVariants.map(v => ({ patientPhone: v }));
          photoOr.push({ patientId: patient._id.toString() });
          weeklyPhotos = await WeeklyPhoto.find({ $or: photoOr })
            .sort({ weekNumber: -1 })
            .limit(12)
            .select('weekNumber photoUrl photoData uploadDate skinScore dayOfJourney notes coachRating coachNote')
            .lean();
        }

        // Consistency stats from last 7 check-ins
        const completedCIs   = recentCheckIns.filter(c => c.completed).length;
        const dietFollowed    = recentCheckIns.filter(c => c.dietFollowed === 'Yes' || c.dietFollowed === 'Partial').length;
        const sunscreenUsed   = recentCheckIns.filter(c => c.sunscreen).length;
        const latestSkinScore = skinScores[0] || null;

        // Days absent since last check-in
        let daysAbsent = null;
        if (streak?.lastCheckIn) {
          daysAbsent = Math.floor((new Date() - new Date(streak.lastCheckIn)) / (1000 * 60 * 60 * 24));
        }

        return {
          // ── Airtable data ──────────────────────────────────────
          airtable: {
            id: plan.id,
            treatmentPlan: plan.treatmentPlan,
            customerName: plan.customerName,
            customerPhone: plan.customerPhone,
            dialCode: plan.dialCode,
            dieticianCallStatus: plan.dieticianCallStatus,
            dietPlanStatus: plan.dietPlanStatus,
            dietPlanDate: plan.dietPlanDate,
            products: plan.products || [],
          },
          // ── MongoDB data (null if customer not in app) ─────────
          mongodb: patient ? {
            patientId: patient._id,
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
            // Products
            products: (patient.products || []).map(p => ({
              id: p._id,
              name: p.name,
              category: p.category,
              instructions: p.instructions,
              isActive: p.isActive,
            })),
            // Streak
            streak: {
              currentStreak: streak?.currentStreak || 0,
              longestStreak: streak?.longestStreak || 0,
              lastCheckIn: streak?.lastCheckIn || null,
              daysAbsent,
            },
            // Last 7 days summary
            last7Days: {
              checkInsCompleted: completedCIs,
              dietFollowed,
              sunscreenUsed,
              checkIns: recentCheckIns.map(c => ({
                date: c.date,
                completed: c.completed,
                skinScore: c.skinScore,
                mood: c.mood,
                dietFollowed: c.dietFollowed,
                sunscreen: c.sunscreen,
              })),
            },
            // Skin score progress
            latestSkinScore: latestSkinScore ? {
              date: latestSkinScore.date,
              day: latestSkinScore.day,
              totalScore: latestSkinScore.totalScore,
            } : null,
            skinScoreHistory: skinScores.map(s => ({
              date: s.date,
              day: s.day,
              totalScore: s.totalScore,
            })),
            // Weekly photos
            weeklyPhotos: weeklyPhotos.map(p => ({
              weekNumber: p.weekNumber,
              // Use the stored Airtable URL when available; fall back to the
              // base64 data-URI so the admin dashboard always has something to display.
              photoUrl: p.photoUrl || p.photoData || '',
              uploadDate: p.uploadDate,
              skinScore: p.skinScore,
              dayOfJourney: p.dayOfJourney,
              notes: p.notes,
              coachRating: p.coachRating ?? null,
              coachNote: p.coachNote || '',
            })),
          } : null,
        };
      })
    );

    // Remove nulls (filtered out when onlyInApp=true)
    const data = results.filter(Boolean);

    // Sort: in-app customers first, then by dietician call status
    data.sort((a, b) => {
      if (a.mongodb && !b.mongodb) return -1;
      if (!a.mongodb && b.mongodb) return 1;
      return 0;
    });

    res.json({
      success: true,
      dieticianName: name,
      count: data.length,
      inAppCount: data.filter(d => d.mongodb !== null).length,
      data,
    });
  } catch (error) {
    console.error('Dietician customers error:', error);
    res.status(500).json({ error: 'Failed to fetch dietician customers' });
  }
});

module.exports = router;
