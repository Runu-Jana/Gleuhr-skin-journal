const express = require('express');
const router = express.Router();
const Patient = require('./models/Patient');
const DailyCheckIn = require('./models/DailyCheckIn');
const SkinScore = require('./models/SkinScore');
const Streak = require('./models/Streak');
const adminAuth = require('./middleware/adminAuth');

// Apply authentication to all admin routes
router.use(adminAuth);

// Admin Dashboard Data API
router.get('/dashboard', async (req, res) => {
  try {
    // Get all patients
    const patients = await Patient.find({});
    
    // Calculate statistics
    const totalPatients = patients.length;
    const activePatients = patients.filter(p => !p.onHold).length;
    
    // Get today's check-ins
    const today = new Date().toISOString().split('T')[0];
    const todayCheckIns = await DailyCheckIn.find({
      date: {
        $gte: new Date(today),
        $lt: new Date(today + 'T23:59:59.999Z')
      }
    });
    
    // Get patients needing attention (7+ days absent)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const needAttention = [];
    const flaggedPatients = [];
    let scheduledCalls = [];
    const reorderConversations = [];
    
    for (const patient of patients) {
      const lastCheckin = await DailyCheckIn.findOne({ patientId: patient._id })
        .sort({ date: -1 });
      
      const streak = await Streak.findOne({ 
        $or: [
          { phoneNumber: patient.phone },
          { patientPhone: patient.phone }
        ]
      });
      
      const consistency = await calculateConsistency(patient._id);
      
      // Check if patient needs attention
      if (lastCheckin && lastCheckin.date < sevenDaysAgo) {
        needAttention.push({
          _id: patient._id,
          name: patient.name,
          phone: patient.phone,
          patientId: patient.patientId,
          daysAbsent: Math.floor((new Date() - lastCheckin.date) / (1000 * 60 * 60 * 24)),
          consistency,
          status: '7 Days Absent',
          priority: 'Phone call required'
        });
      }
      
      // Check for flagged patients
      if (consistency < 75 && consistency >= 50) {
        flaggedPatients.push({
          _id: patient._id,
          name: patient.name,
          phone: patient.phone,
          patientId: patient.patientId,
          day: Math.floor((new Date() - new Date(patient.startDate)) / (1000 * 60 * 60 * 24)) + 1,
          streak: streak?.currentStreak || 0,
          consistency,
          status: getFlaggedReason(lastCheckin, consistency)
        });
      }
      
      // Check for reorder conversations
      const currentDay = Math.floor((new Date() - new Date(patient.startDate)) / (1000 * 60 * 60 * 24)) + 1;
      if (currentDay >= 35 && currentDay <= 37) {
        reorderConversations.push({
          _id: patient._id,
          name: patient.name,
          phone: patient.phone,
          patientId: patient.patientId,
          day: currentDay,
          streak: streak?.currentStreak || 0,
          consistency,
          status: 'Reorder Window'
        });
      }
    }
    
    // Get scheduled calls (new patients)
    const newPatients = patients.filter(p => {
      const daysSinceStart = Math.floor((new Date() - new Date(p.startDate)) / (1000 * 60 * 60 * 24));
      return daysSinceStart <= 3;
    });
    
    scheduledCalls = newPatients.map(p => ({
      _id: p._id,
      name: p.name,
      phone: p.phone,
      patientId: p.patientId,
      status: 'New Patient',
      priority: 'Introduction call'
    }));
    
    // Calculate average consistency
    const consistencyPromises = patients.map(p => calculateConsistency(p._id));
    const consistencyValues = await Promise.all(consistencyPromises);
    const avgConsistency = patients.length > 0 
      ? Math.round(consistencyValues.reduce((sum, val) => sum + (val || 0), 0) / patients.length)
      : 0;
    
    res.json({
      stats: {
        needAttention: needAttention.length,
        callsToday: scheduledCalls.length,
        avgConsistency,
        reorderDue: reorderConversations.length
      },
      patients: {
        needAttention,
        flagged: flaggedPatients,
        scheduledCalls,
        reorderConversations
      },
      summary: {
        totalPatients,
        activePatients,
        date: new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      }
    });
    
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get detailed patient information
router.get('/patient/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Get patient's check-ins
    const checkIns = await DailyCheckIn.find({ patientId: patient._id })
      .sort({ date: -1 })
      .limit(30);
    
    // Get patient's skin scores
    const skinScores = await SkinScore.find({ patient: patient._id })
      .sort({ date: -1 })
      .limit(12);
    
    // Get patient's streak
    const streak = await Streak.findOne({
      $or: [
        { phoneNumber: patient.phone },
        { patientPhone: patient.phone }
      ]
    });
    
    // Calculate consistency
    const consistency = await calculateConsistency(patient._id);
    
    res.json({
      _id: patient._id,
      name: patient.name,
      phone: patient.phone,
      patientId: patient.patientId,
      day: Math.floor((new Date() - new Date(patient.startDate)) / (1000 * 60 * 60 * 24)) + 1,
      streak: streak?.currentStreak || 0,
      consistency,
      recentCheckIns: checkIns.map(ci => ({
        date: ci.date,
        amRoutine: ci.amRoutine,
        pmRoutine: ci.pmRoutine,
        dietFollowed: ci.dietFollowed,
        waterIntake: ci.waterIntake,
        sunscreenApplied: ci.sunscreenApplied
      })),
      skinScores: skinScores.map(ss => ({
        date: ss.date,
        totalScore: ss.totalScore,
        individualScores: ss.individualScores
      })),
      startDate: patient.startDate,
      onHold: patient.onHold
    });
    
  } catch (error) {
    console.error('Patient details error:', error);
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

// Helper function to calculate consistency
async function calculateConsistency(patientId) {
  try {
    const checkIns = await DailyCheckIn.find({ patientId });
    if (checkIns.length === 0) return 0;
    
    const startDate = new Date(checkIns[0].date);
    const expectedDays = Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const consistency = Math.round((checkIns.length / expectedDays) * 100);
    
    return Math.min(100, consistency);
  } catch (error) {
    return 0;
  }
}

// Helper function to determine flagged reason
function getFlaggedReason(lastCheckin, consistency) {
  if (!lastCheckin) return 'No recent check-ins';
  if (!lastCheckin.sunscreen) return 'Sunscreen Skipping';
  if (lastCheckin.dietFollowed === 'No') return 'Diet Struggling';
  if (consistency < 60) return 'Consistency Declining';
  return 'Needs Attention';
}

module.exports = router;
