const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Streak = require('../models/Streak');
const DailyCheckIn = require('../models/DailyCheckIn');
const SkinScore = require('../models/SkinScore');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

/**
 * GET /api/admin/overview
 * Aggregated stats for the Admin Command Center dashboard.
 */
router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const last7Dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Dates.push(d.toISOString().split('T')[0]);
    }

    // Parallel fetch of core collections
    const [patients, streaks, todayCheckIns, recentCheckIns, allSkinScores] = await Promise.all([
      Patient.find({}).lean(),
      Streak.find({}).lean(),
      DailyCheckIn.find({ date: today }).lean(),
      DailyCheckIn.find({ date: { $in: last7Dates } }).lean(),
      SkinScore.find({}).sort({ date: -1 }).lean(),
    ]);

    const totalPatients = patients.length;
    const activatedPatients = patients.filter(p => p.isActive !== false).length;
    const activationRate = totalPatients > 0
      ? Math.round((activatedPatients / totalPatients) * 100) : 0;

    // ── Retention: patients at day 28+ ─────────────────────────────────────
    const retainedPatients = patients.filter(p => (p.currentDay || 0) >= 28).length;
    const retentionDenominator = patients.filter(p => (p.startDate && (
      Math.floor((new Date() - new Date(p.startDate)) / (1000 * 60 * 60 * 24)) >= 28
    ))).length;

    // ── Coach workload ──────────────────────────────────────────────────────
    const coachMap = {};
    patients.forEach(p => {
      const coach = p.coachName || 'Unassigned';
      coachMap[coach] = (coachMap[coach] || 0) + 1;
    });
    const coachWorkload = Object.entries(coachMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const totalCoaches = Object.keys(coachMap).filter(k => k !== 'Unassigned').length;

    // ── Consistency (rough per-patient estimate from recentCheckIns) ────────
    // Use last 7 days check-ins per patient to estimate avg consistency
    const phoneToConsistency = {};
    recentCheckIns.forEach(ci => {
      const key = ci.patientPhone || ci.patientId;
      if (!key) return;
      if (!phoneToConsistency[key]) phoneToConsistency[key] = new Set();
      phoneToConsistency[key].add(ci.date);
    });
    const consistencyValues = Object.values(phoneToConsistency)
      .map(dates => Math.round((dates.size / 7) * 100));
    const avgConsistency = consistencyValues.length > 0
      ? Math.round(consistencyValues.reduce((a, b) => a + b, 0) / consistencyValues.length) : 0;

    // ── Avg skin score (latest per patient) ─────────────────────────────────
    const seenPhones = new Set();
    let skinScoreSum = 0;
    let skinScoreCount = 0;
    allSkinScores.forEach(s => {
      const key = s.phoneNumber || s.patientId;
      if (!key || seenPhones.has(key)) return;
      seenPhones.add(key);
      if (s.totalScore != null) {
        skinScoreSum += s.totalScore;
        skinScoreCount++;
      }
    });
    const avgSkinScore = skinScoreCount > 0
      ? parseFloat((skinScoreSum / skinScoreCount).toFixed(1)) : 0;

    // ── Today's pulse ───────────────────────────────────────────────────────
    const amCheckIns = todayCheckIns.filter(c => c.amRoutine).length;
    const pmCheckIns = todayCheckIns.filter(c => c.pmRoutine).length;
    const urgentFlags = streaks.filter(s => {
      if (!s.lastCheckIn) return false;
      const daysAbsent = Math.floor(
        (new Date() - new Date(s.lastCheckIn)) / (1000 * 60 * 60 * 24)
      );
      return daysAbsent >= 3;
    }).length;

    // ── Drop-off funnel ──────────────────────────────────────────────────────
    // For each milestone day, count patients whose currentDay >= milestone
    const milestones = [0, 7, 14, 21, 28, 42];
    const dropOffFunnel = milestones.map(day => {
      const count = day === 0
        ? activatedPatients
        : patients.filter(p => (p.currentDay || 0) >= day).length;
      return {
        label: day === 0 ? 'Activated' : `Day ${day}`,
        count,
        percentage: activatedPatients > 0
          ? Math.round((count / activatedPatients) * 100) : 0,
      };
    });

    // ── Check-in rates (last 7 days) ─────────────────────────────────────────
    const totalPossible = totalPatients * 7;
    const amLast7 = recentCheckIns.filter(c => c.amRoutine).length;
    const pmLast7 = recentCheckIns.filter(c => c.pmRoutine).length;
    const bothLast7 = recentCheckIns.filter(c => c.amRoutine && c.pmRoutine).length;
    const amRate = totalPossible > 0 ? Math.round((amLast7 / totalPossible) * 100) : 0;
    const pmRate = totalPossible > 0 ? Math.round((pmLast7 / totalPossible) * 100) : 0;
    const bothRate = totalPossible > 0 ? Math.round((bothLast7 / totalPossible) * 100) : 0;

    // ── Streak distribution ──────────────────────────────────────────────────
    const streakDist = { '0': 0, '1-7': 0, '8-14': 0, '15-30': 0, '30+': 0 };
    let totalShieldCount = 0;
    let patientsNoShields = 0;
    let patientsFullShields = 0;
    streaks.forEach(s => {
      const curr = s.currentStreak || 0;
      if (curr === 0) streakDist['0']++;
      else if (curr <= 7) streakDist['1-7']++;
      else if (curr <= 14) streakDist['8-14']++;
      else if (curr <= 30) streakDist['15-30']++;
      else streakDist['30+']++;

      const maxShields = s.monthly?.default || 3;
      const usedShields = s.monthly?.used || 0;
      const remaining = maxShields - usedShields;
      totalShieldCount += remaining;
      if (remaining === 0) patientsNoShields++;
      if (remaining >= maxShields) patientsFullShields++;
    });
    const avgShields = streaks.length > 0
      ? parseFloat((totalShieldCount / streaks.length).toFixed(1)) : 0;

    // ── Skin score trajectory (avg score at key day milestones) ──────────────
    const trajectoryDays = [1, 28, 56, 84];
    const scoresByMilestone = {};
    trajectoryDays.forEach(d => { scoresByMilestone[d] = []; });
    allSkinScores.forEach(s => {
      if (s.day == null || s.totalScore == null) return;
      const closest = trajectoryDays.reduce((prev, curr) =>
        Math.abs(curr - s.day) < Math.abs(prev - s.day) ? curr : prev
      );
      if (Math.abs(closest - s.day) <= 7) {
        scoresByMilestone[closest].push(s.totalScore);
      }
    });
    const skinTrajectory = trajectoryDays.map(day => ({
      day,
      avgScore: scoresByMilestone[day].length > 0
        ? parseFloat(
            (scoresByMilestone[day].reduce((a, b) => a + b, 0) / scoresByMilestone[day].length)
              .toFixed(1)
          )
        : null,
    }));

    res.json({
      success: true,
      data: {
        totalPatients,
        activatedPatients,
        activationRate,
        avgConsistency,
        avgSkinScore,
        retainedPatients,
        retentionDenominator,
        retentionRate: retentionDenominator > 0
          ? Math.round((retainedPatients / retentionDenominator) * 100) : 0,
        totalCoaches,
        todaysPulse: {
          amCheckIns,
          pmCheckIns,
          totalPatients,
          urgentFlags,
          photoConsents: 0,
        },
        dropOffFunnel,
        engagement: {
          amRate,
          pmRate,
          bothRate,
          streakDistribution: streakDist,
          shieldUsage: {
            avg: avgShields,
            none: patientsNoShields,
            full: patientsFullShields,
          },
          coachWorkload,
        },
        outcomes: {
          skinTrajectory,
        },
      },
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to fetch admin overview' });
  }
});

module.exports = router;
