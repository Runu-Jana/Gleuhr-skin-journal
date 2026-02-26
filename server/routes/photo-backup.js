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

    // Also save to MongoDB for better analytics and querying
    try {
      // Find or create patient in MongoDB
      let patient = await Patient.findOne({ phone: patientPhone });
      if (!patient && patientId) {
        patient = await Patient.findOne({ airtableId: patientId });
      }

      if (patient) {
        // Calculate day of journey
        const dayOfJourney = Math.floor(
          (new Date(date) - new Date(patient.startDate)) / (1000 * 60 * 60 * 24)
        ) + 1;

        // Create weekly photo record
        const weeklyPhoto = new WeeklyPhoto({
          patientId: patient._id,
          patientPhone: patient.phone,
          weekNumber: parseInt(week),
          photoUrl: photoUrl,
          photoData: photoUrl, // Store URL as photo data for now
          uploadDate: new Date(date),
          dayOfJourney: dayOfJourney,
          skinScore: 0, // Will be updated when skin score is available
          notes: '',
          tags: [],
          isPublic: consentGiven || false
        });

        await weeklyPhoto.save();
      }
    } catch (mongoError) {
      console.log('MongoDB save failed (continuing with Airtable):', mongoError.message);
    }

    res.json({
      success: true,
      id: patientRecords[0].id,
      message: 'Photo saved successfully'
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Failed to save photo' });
  }
});

// GET /api/photo/:phone - Get weekly photos for a patient by phone
router.get('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const patientRecords = await base(TABLES.DIET_PLANS)
      .select({
        filterByFormula: `{Phone Number} = '${phone}'`,
        maxRecords: 1
      })
      .firstPage();

    if (patientRecords.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const photos = patientRecords[0].fields['Weekly Photos'] || [];

    res.json({
      success: true,
      photos
    });
  } catch (error) {
    console.error('Fetch photos error:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

module.exports = router;
