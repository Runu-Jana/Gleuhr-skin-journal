const express = require('express');
const router = express.Router();
const SkinScore = require('../models/SkinScore');
const Patient = require('../models/Patient');

// POST /api/skinscore - Save skin score assessment
router.post('/', async (req, res) => {
  try {
    const {
      patientId,
      patientPhone,
      date,
      day,
      darkest_patch,
      skin_tone,
      texture,
      confidence,
      totalScore,
      photoUrl,
      notes
    } = req.body;

    if (!patientPhone || !date || day === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find patient by phone
    const patient = await Patient.findOne({
      $or: [
        { phoneNumber: patientPhone },
        { phone: patientPhone }
      ]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Create skin score record
    // Calculate total score from 4 questions (1-5 scale each, max 20)
    const metrics = [
      darkest_patch || 0,
      skin_tone || 0,
      texture || 0,
      confidence || 0
    ];
    const calculatedTotalScore = metrics.reduce((sum, val) => sum + val, 0);

    const skinScore = new SkinScore({
      patient: patient._id,
      phoneNumber: patientPhone,
      date: new Date(date),
      day,
      darkest_patch: darkest_patch || 0,
      skin_tone: skin_tone || 0,
      texture: texture || 0,
      confidence: confidence || 0,
      totalScore: calculatedTotalScore,
      photoUrl,
      notes: notes || '',
      synced: true
    });

    await skinScore.save();

    res.json({
      success: true,
      id: skinScore._id,
      totalScore: skinScore.totalScore,
      message: 'Skin score saved successfully'
    });
  } catch (error) {
    console.error('Skin score error:', error);
    res.status(500).json({ error: 'Failed to save skin score' });
  }
});

// GET /api/skinscore/:phone - Get skin scores for a patient
router.get('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    // Find patient by phone
    const patient = await Patient.findOne({
      $or: [
        { phoneNumber: phone },
        { phone: phone }
      ]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get skin scores for this patient
    const scores = await SkinScore.find({ patient: patient._id })
      .sort({ date: -1 });

    const scoreData = scores.map(score => ({
      id: score._id,
      date: score.date,
      day: score.day,
      darkest_patch: score.darkest_patch,
      skin_tone: score.skin_tone,
      texture: score.texture,
      confidence: score.confidence,
      totalScore: score.totalScore,
      photoUrl: score.photoUrl,
      notes: score.notes
    }));

    res.json(scoreData);
  } catch (error) {
    console.error('Fetch skin scores error:', error);
    res.status(500).json({ error: 'Failed to fetch skin scores' });
  }
});

// GET /api/skinscore/:phone/latest - Get latest skin score for a patient
router.get('/:phone/latest', async (req, res) => {
  try {
    const { phone } = req.params;
    
    // Find patient by phone
    const patient = await Patient.findOne({
      $or: [
        { phoneNumber: phone },
        { phone: phone }
      ]
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get latest skin score for this patient
    const latestScore = await SkinScore.findOne({ patient: patient._id })
      .sort({ date: -1 });

    if (!latestScore) {
      return res.json({
        id: null,
        date: null,
        day: null,
        totalScore: 0,
        message: 'No skin scores found'
      });
    }

    res.json({
      id: latestScore._id,
      date: latestScore.date,
      day: latestScore.day,
      darkest_patch: latestScore.darkest_patch,
      skin_tone: latestScore.skin_tone,
      texture: latestScore.texture,
      confidence: latestScore.confidence,
      totalScore: latestScore.totalScore,
      photoUrl: latestScore.photoUrl,
      notes: latestScore.notes
    });
  } catch (error) {
    console.error('Fetch latest skin score error:', error);
    res.status(500).json({ error: 'Failed to fetch latest skin score' });
  }
});

module.exports = router;
