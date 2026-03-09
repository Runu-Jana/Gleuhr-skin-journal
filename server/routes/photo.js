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
      weekNumber,
      date,
      day,
      photoUrl,
      photoData,
      skinScore,
      notes,
      tags
    } = req.body;

    // Support both patientId and patientPhone
    if (!patientId && !patientPhone) {
      return res.status(400).json({ error: 'Missing patient identifier' });
    }

    const weekNum = weekNumber || week;
    if (!weekNum) {
      return res.status(400).json({ error: 'Missing required field: week' });
    }

    // Find patient by ID or phone
    let patient;
    if (patientId) {
      patient = await Patient.findById(patientId);
    }
    if (!patient && patientPhone) {
      patient = await Patient.findOne({
        $or: [
          { phoneNumber: patientPhone },
          { phone: patientPhone }
        ]
      });
    }

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const dayOfJourney = day || patient.currentDay || 1;
    const pid = patient._id.toString();
    const pPhone = patient.phone || patient.phoneNumber;

    // Upsert: update if photo for this week already exists, otherwise create
    const weeklyPhoto = await WeeklyPhoto.findOneAndUpdate(
      { patientId: pid, weekNumber: weekNum },
      {
        $set: {
          patientPhone: pPhone,
          photoUrl: photoUrl || '',
          photoData: photoData || '',
          uploadDate: date ? new Date(date) : new Date(),
          dayOfJourney,
          skinScore: skinScore || 0,
          notes: notes || '',
          tags: tags || [],
          updatedAt: new Date()
        },
        $setOnInsert: {
          patientId: pid,
          weekNumber: weekNum,
          createdAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

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
    const photos = await WeeklyPhoto.find({
      $or: [
        { patientId: patient._id.toString() },
        { patientPhone: phone }
      ]
    }).sort({ weekNumber: -1 });

    const photoData = photos.map(photo => ({
      id: photo._id,
      week: photo.weekNumber,
      date: photo.uploadDate,
      photoUrl: photo.photoUrl,
      photoData: photo.photoData,
      dayOfJourney: photo.dayOfJourney,
      skinScore: photo.skinScore,
      notes: photo.notes
    }));

    res.json(photoData);
  } catch (error) {
    console.error('Fetch photos error:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

module.exports = router;
