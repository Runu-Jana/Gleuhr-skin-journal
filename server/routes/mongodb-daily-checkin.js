const express = require('express');
const router = express.Router();
const DailyCheckIn = require('../models/DailyCheckIn');
const Patient = require('../models/Patient');

// Get daily check-ins for a patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 30, page = 1, startDate, endDate } = req.query;
    
    let query = { patientId };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const checkIns = await DailyCheckIn.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await DailyCheckIn.countDocuments(query);
    
    res.json({
      success: true,
      data: checkIns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching daily check-ins:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch daily check-ins' });
  }
});

// Create or update daily check-in
router.post('/checkin', async (req, res) => {
  try {
    const {
      patientId,
      patientPhone,
      date,
      dayOfJourney,
      skinScore,
      skinScores,
      mood,
      energy,
      sleep,
      waterIntake,
      medications,
      notes,
      symptoms
    } = req.body;
    
    // Check if check-in for this date already exists
    const existingCheckIn = await DailyCheckIn.findOne({ 
      patientId, 
      date: new Date(date).toISOString().split('T')[0]
    });
    
    if (existingCheckIn) {
      // Update existing check-in
      existingCheckIn.skinScore = skinScore;
      existingCheckIn.skinScores = skinScores;
      existingCheckIn.mood = mood;
      existingCheckIn.energy = energy;
      existingCheckIn.sleep = sleep;
      existingCheckIn.waterIntake = waterIntake;
      existingCheckIn.medications = medications || [];
      existingCheckIn.notes = notes || '';
      existingCheckIn.symptoms = symptoms || [];
      existingCheckIn.completed = true;
      existingCheckIn.completedAt = new Date();
      
      await existingCheckIn.save();
      res.json({ success: true, data: existingCheckIn });
    } else {
      // Get patient phone if not provided
      let phone = patientPhone || '';
      if (!phone) {
        const patient = await Patient.findById(patientId);
        phone = patient ? patient.phone : '';
      }
      
      // Create new check-in record
      const newCheckIn = new DailyCheckIn({
        patientId,
        patientPhone: phone,
        date: new Date(date),
        dayOfJourney,
        skinScore,
        skinScores,
        mood,
        energy,
        sleep,
        waterIntake,
        medications: medications || [],
        notes: notes || '',
        symptoms: symptoms || [],
        completed: true,
        completedAt: new Date()
      });
      
      await newCheckIn.save();
      res.json({ success: true, data: newCheckIn });
    }
  } catch (error) {
    console.error('Error creating daily check-in:', error);
    res.status(500).json({ success: false, error: 'Failed to create daily check-in' });
  }
});

// Get specific daily check-in
router.get('/:checkinId', async (req, res) => {
  try {
    const { checkinId } = req.params;
    
    const checkIn = await DailyCheckIn.findById(checkinId);
    
    if (!checkIn) {
      return res.status(404).json({ success: false, error: 'Check-in not found' });
    }
    
    res.json({ success: true, data: checkIn });
  } catch (error) {
    console.error('Error fetching check-in:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch check-in' });
  }
});

// Get today's check-in for patient
router.get('/today/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    const checkIn = await DailyCheckIn.findOne({ 
      patientId, 
      date: new Date(today) 
    });
    
    res.json({ success: true, data: checkIn || null });
  } catch (error) {
    console.error('Error fetching today\'s check-in:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch today\'s check-in' });
  }
});

// Get daily check-in statistics
router.get('/stats/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { period = '30' } = req.query; // days
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    
    const stats = await DailyCheckIn.aggregate([
      { $match: { patientId, date: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          totalCheckIns: { $sum: 1 },
          averageSkinScore: { $avg: '$skinScore' },
          highestSkinScore: { $max: '$skinScore' },
          lowestSkinScore: { $min: '$skinScore' },
          averageSleep: { $avg: '$sleep' },
          averageWaterIntake: { $avg: '$waterIntake' },
          moodDistribution: {
            $push: '$mood'
          }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalCheckIns: 0,
      averageSkinScore: 0,
      highestSkinScore: 0,
      lowestSkinScore: 0,
      averageSleep: 0,
      averageWaterIntake: 0,
      moodDistribution: []
    };
    
    // Calculate mood distribution
    const moodCounts = {};
    result.moodDistribution.forEach(mood => {
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });
    
    res.json({ 
      success: true, 
      data: {
        ...result,
        moodCounts,
        period: parseInt(period)
      }
    });
  } catch (error) {
    console.error('Error fetching check-in stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch check-in statistics' });
  }
});

// Get check-in trends
router.get('/trends/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { period = '30' } = req.query; // days
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    
    const trends = await DailyCheckIn.find({ 
      patientId, 
      date: { $gte: startDate } 
    })
    .sort({ date: 1 })
    .select('date skinScore mood energy sleep waterIntake');
    
    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('Error fetching check-in trends:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch check-in trends' });
  }
});

module.exports = router;
