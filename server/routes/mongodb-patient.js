const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Streak = require('../models/Streak');
const DailyCheckIn = require('../models/DailyCheckIn');
const WeeklyPhoto = require('../models/WeeklyPhoto');

// Sync patient from Airtable to MongoDB
router.post('/sync', async (req, res) => {
  try {
    const { airtableId, email, phone, name, startDate, profile, commitment } = req.body;
    
    // Check if patient already exists
    let patient = await Patient.findOne({ 
      $or: [{ airtableId }, { email }, { phone }] 
    });
    
    if (patient) {
      // Update existing patient
      patient.airtableId = airtableId;
      patient.email = email;
      patient.phone = phone;
      patient.name = name;
      patient.startDate = new Date(startDate);
      patient.profile = profile || patient.profile;
      patient.commitment = commitment || patient.commitment;
      patient.lastLogin = new Date();
      
      await patient.save();
    } else {
      // Create new patient
      patient = new Patient({
        airtableId,
        email,
        phone,
        name,
        startDate: new Date(startDate),
        profile: profile || {},
        commitment: commitment || 'none',
        lastLogin: new Date()
      });
      
      await patient.save();
    }
    
    res.json({ success: true, data: patient });
  } catch (error) {
    console.error('Error syncing patient:', error);
    res.status(500).json({ success: false, error: 'Failed to sync patient' });
  }
});

// Get patient by email or phone
router.get('/find', async (req, res) => {
  try {
    const { email, phone } = req.query;
    
    let patient;
    if (email) {
      patient = await Patient.findOne({ email });
    } else if (phone) {
      patient = await Patient.findOne({ phone });
    }
    
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    
    res.json({ success: true, data: patient });
  } catch (error) {
    console.error('Error finding patient:', error);
    res.status(500).json({ success: false, error: 'Failed to find patient' });
  }
});

// Get patient dashboard data
router.get('/dashboard/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    // Get patient info
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    
    // Get streak data
    const streak = await Streak.findOne({ patientId });
    
    // Get recent check-ins
    const recentCheckIns = await DailyCheckIn.find({ patientId })
      .sort({ date: -1 })
      .limit(7);
    
    // Get recent photos
    const recentPhotos = await WeeklyPhoto.find({ patientId })
      .sort({ weekNumber: -1 })
      .limit(4);
    
    // Calculate current day
    const currentDay = Math.floor(
      (new Date() - new Date(patient.startDate)) / (1000 * 60 * 60 * 24)
    ) + 1;
    
    // Get today's check-in
    const today = new Date().toISOString().split('T')[0];
    const todayCheckIn = await DailyCheckIn.findOne({ 
      patientId, 
      date: new Date(today) 
    });
    
    const dashboard = {
      patient: {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        currentDay,
        commitment: patient.commitment,
        startDate: patient.startDate
      },
      streak: streak ? {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastCheckIn: streak.lastCheckIn
      } : {
        currentStreak: 0,
        longestStreak: 0,
        lastCheckIn: null
      },
      todayCheckIn: todayCheckIn ? {
        completed: todayCheckIn.completed,
        skinScore: todayCheckIn.skinScore
      } : null,
      recentCheckIns: recentCheckIns.map(ci => ({
        date: ci.date,
        skinScore: ci.skinScore,
        mood: ci.mood,
        completed: ci.completed
      })),
      recentPhotos: recentPhotos.map(photo => ({
        weekNumber: photo.weekNumber,
        photoUrl: photo.photoUrl,
        skinScore: photo.skinScore,
        uploadDate: photo.uploadDate
      }))
    };
    
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// Update patient profile
router.put('/profile/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { profile, preferences, commitment } = req.body;
    
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    
    if (profile) patient.profile = { ...patient.profile, ...profile };
    if (preferences) patient.preferences = { ...patient.preferences, ...preferences };
    if (commitment) patient.commitment = commitment;
    
    await patient.save();
    
    res.json({ success: true, data: patient });
  } catch (error) {
    console.error('Error updating patient profile:', error);
    res.status(500).json({ success: false, error: 'Failed to update patient profile' });
  }
});

// Get patient statistics
router.get('/stats/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    // Get patient info
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
    
    // Get streak stats
    const streakStats = await Streak.aggregate([
      { $match: { patientId } },
      {
        $group: {
          _id: null,
          currentStreak: { $first: '$currentStreak' },
          longestStreak: { $first: '$longestStreak' },
          totalCheckIns: { $size: '$checkInDates' }
        }
      }
    ]);
    
    // Get check-in stats
    const checkInStats = await DailyCheckIn.aggregate([
      { $match: { patientId } },
      {
        $group: {
          _id: null,
          totalCheckIns: { $sum: 1 },
          averageSkinScore: { $avg: '$skinScore' },
          highestSkinScore: { $max: '$skinScore' },
          lowestSkinScore: { $min: '$skinScore' },
          averageSleep: { $avg: '$sleep' },
          averageWaterIntake: { $avg: '$waterIntake' }
        }
      }
    ]);
    
    // Get photo stats
    const photoStats = await WeeklyPhoto.aggregate([
      { $match: { patientId } },
      {
        $group: {
          _id: null,
          totalPhotos: { $sum: 1 },
          averageSkinScore: { $avg: '$skinScore' },
          latestWeek: { $max: '$weekNumber' }
        }
      }
    ]);
    
    const stats = {
      patient: {
        name: patient.name,
        currentDay: Math.floor((new Date() - new Date(patient.startDate)) / (1000 * 60 * 60 * 24)) + 1,
        commitment: patient.commitment
      },
      streak: streakStats[0] || {
        currentStreak: 0,
        longestStreak: 0,
        totalCheckIns: 0
      },
      checkIns: checkInStats[0] || {
        totalCheckIns: 0,
        averageSkinScore: 0,
        highestSkinScore: 0,
        lowestSkinScore: 0,
        averageSleep: 0,
        averageWaterIntake: 0
      },
      photos: photoStats[0] || {
        totalPhotos: 0,
        averageSkinScore: 0,
        latestWeek: 0
      }
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching patient stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch patient statistics' });
  }
});

module.exports = router;
