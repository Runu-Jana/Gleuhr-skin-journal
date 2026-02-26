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
      texture,
      pigmentation,
      brightness,
      breakouts,
      confidence,
      hydration,
      smoothness,
      evenness,
      firmness,
      glow,
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
    const skinScore = new SkinScore({
      patient: patient._id,
      phoneNumber: patientPhone,
      date,
      day,
      texture: texture || 5,
      pigmentation: pigmentation || 5,
      brightness: brightness || 5,
      breakouts: breakouts || 5,
      confidence: confidence || 5,
      hydration: hydration || 5,
      smoothness: smoothness || 5,
      evenness: evenness || 5,
      firmness: firmness || 5,
      glow: glow || 5,
      totalScore: totalScore || 50,
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
      texture: score.texture,
      pigmentation: score.pigmentation,
      brightness: score.brightness,
      breakouts: score.breakouts,
      confidence: score.confidence,
      hydration: score.hydration,
      smoothness: score.smoothness,
      evenness: score.evenness,
      firmness: score.firmness,
      glow: score.glow,
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
      texture: latestScore.texture,
      pigmentation: latestScore.pigmentation,
      brightness: latestScore.brightness,
      breakouts: latestScore.breakouts,
      confidence: latestScore.confidence,
      hydration: latestScore.hydration,
      smoothness: latestScore.smoothness,
      evenness: latestScore.evenness,
      firmness: latestScore.firmness,
      glow: latestScore.glow,
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
