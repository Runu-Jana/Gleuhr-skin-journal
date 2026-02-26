const express = require('express');
const router = express.Router();
const Streak = require('../models/Streak');
const Patient = require('../models/Patient');

// Get streak data for a patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    let streak = await Streak.findOne({ patientId });
    
    if (!streak) {
      // Get patient phone from Patient model
      let patientPhone = req.query.phone || '';
      if (!patientPhone) {
        const patient = await Patient.findById(patientId);
        patientPhone = patient ? patient.phone : '';
      }
      
      // Create new streak record
      streak = new Streak({
        patientId,
        patientPhone,
        currentStreak: 0,
        longestStreak: 0,
        checkInDates: [],
        milestones: [
          { streak: 7, achieved: false, achievedDate: null },
          { streak: 14, achieved: false, achievedDate: null },
          { streak: 30, achieved: false, achievedDate: null },
          { streak: 60, achieved: false, achievedDate: null },
          { streak: 90, achieved: false, achievedDate: null }
        ]
      });
      await streak.save();
    }
    
    res.json({ success: true, data: streak });
  } catch (error) {
    console.error('Error fetching streak:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch streak data' });
  }
});

// Update streak after check-in
router.post('/checkin', async (req, res) => {
  try {
    const { patientId, patientPhone, date, dayOfJourney } = req.body;
    
    let streak = await Streak.findOne({ patientId });
    
    if (!streak) {
      // Get patient phone if not provided
      let phone = patientPhone || '';
      if (!phone) {
        const patient = await Patient.findById(patientId);
        phone = patient ? patient.phone : '';
      }
      
      streak = new Streak({
        patientId,
        patientPhone: phone,
        currentStreak: 0,
        longestStreak: 0,
        checkInDates: [],
        milestones: [
          { streak: 7, achieved: false, achievedDate: null },
          { streak: 14, achieved: false, achievedDate: null },
          { streak: 30, achieved: false, achievedDate: null },
          { streak: 60, achieved: false, achievedDate: null },
          { streak: 90, achieved: false, achievedDate: null }
        ]
      });
    }
    
    // Add check-in date
    const checkInDate = new Date(date);
    const existingCheckIn = streak.checkInDates.find(
      ci => ci.date.toDateString() === checkInDate.toDateString()
    );
    
    if (!existingCheckIn) {
      streak.checkInDates.push({
        date: checkInDate,
        completed: true,
        checkInTime: new Date()
      });
      
      // Calculate current streak
      streak.checkInDates.sort((a, b) => b.date - a.date);
      let currentStreak = 0;
      let lastDate = null;
      
      for (const checkIn of streak.checkInDates) {
        if (checkIn.completed) {
          if (!lastDate) {
            currentStreak = 1;
            lastDate = checkIn.date;
          } else {
            const daysDiff = Math.floor((lastDate - checkIn.date) / (1000 * 60 * 60 * 24));
            if (daysDiff === 1) {
              currentStreak++;
              lastDate = checkIn.date;
            } else {
              break;
            }
          }
        }
      }
      
      streak.currentStreak = currentStreak;
      streak.longestStreak = Math.max(streak.longestStreak, currentStreak);
      streak.lastCheckIn = checkInDate;
      
      // Check milestones
      streak.milestones.forEach(milestone => {
        if (!milestone.achieved && currentStreak >= milestone.streak) {
          milestone.achieved = true;
          milestone.achievedDate = new Date();
        }
      });
      
      await streak.save();
    }
    
    res.json({ success: true, data: streak });
  } catch (error) {
    console.error('Error updating streak:', error);
    res.status(500).json({ success: false, error: 'Failed to update streak' });
  }
});

// Get streak statistics
router.get('/stats/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const streak = await Streak.findOne({ patientId });
    
    if (!streak) {
      return res.json({
        success: true,
        data: {
          currentStreak: 0,
          longestStreak: 0,
          totalCheckIns: 0,
          milestones: []
        }
      });
    }
    
    const stats = {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      totalCheckIns: streak.checkInDates.filter(ci => ci.completed).length,
      milestones: streak.milestones.filter(m => m.achieved),
      nextMilestone: streak.milestones.find(m => !m.achieved)
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching streak stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch streak statistics' });
  }
});

module.exports = router;
