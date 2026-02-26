const express = require('express');
const router = express.Router();
const WeeklyPhoto = require('../models/WeeklyPhoto');
const Patient = require('../models/Patient');

// POST /api/photo - Upload weekly photo
router.post('/', async (req, res) => {
  try {
    const {
      patientId,
      patientPhone,
      week,
      date,
      photoUrl,
      consentGiven
    } = req.body;

    if (!patientPhone || !week || !date) {
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

    // Create weekly photo record
    const weeklyPhoto = new WeeklyPhoto({
      patient: patient._id,
      phoneNumber: patientPhone,
      week,
      date,
      photoUrl,
      consentGiven: consentGiven || false,
      synced: true
    });

    await weeklyPhoto.save();

    res.json({
      success: true,
      id: weeklyPhoto._id,
      message: 'Weekly photo saved successfully'
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Failed to save photo' });
  }
});

// GET /api/photo/:phone - Get weekly photos for a patient
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

    // Get weekly photos for this patient
    const photos = await WeeklyPhoto.find({ patient: patient._id })
      .sort({ week: -1 });

    const photoData = photos.map(photo => ({
      id: photo._id,
      week: photo.week,
      date: photo.date,
      photoUrl: photo.photoUrl,
      consentGiven: photo.consentGiven
    }));

    res.json(photoData);
  } catch (error) {
    console.error('Fetch photos error:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

module.exports = router;
