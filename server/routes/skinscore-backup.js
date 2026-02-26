const express = require('express');
const router = express.Router();
const { base, TABLES } = require('../config/airtable');
const DailyCheckIn = require('../models/DailyCheckIn');
const Streak = require('../models/Streak');
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
      photoUrl
    } = req.body;

    if (!patientPhone || !date || day === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const record = await base(TABLES.SKIN_SCORES).create([
      {
        fields: {
          'Patient Phone': patientPhone,
          'Date': date,
          'Day': day,
          'Texture': texture || 0,
          'Pigmentation': pigmentation || 0,
          'Brightness': brightness || 0,
          'Breakouts': breakouts || 0,
          'Confidence': confidence || 0,
          'Hydration': hydration || 0,
          'Smoothness': smoothness || 0,
          'Evenness': evenness || 0,
          'Firmness': firmness || 0,
          'Glow': glow || 0,
          'Total Score': totalScore || 0,
          'Photo URL': photoUrl || ''
        }
      }
    ]);

    // Also save to MongoDB for better analytics and querying
    try {
      // Find or create patient in MongoDB
      let patient = await Patient.findOne({ phone: patientPhone });
      if (!patient && patientId) {
        patient = await Patient.findOne({ airtableId: patientId });
      }

      if (patient) {
        // Create daily check-in record
        const dailyCheckIn = new DailyCheckIn({
          patientId: patient._id,
          patientPhone: patient.phone,
          date: new Date(date),
          dayOfJourney: day,
          skinScore: totalScore || 0,
          skinScores: {
            texture: texture || 0,
            pigmentation: pigmentation || 0,
            brightness: brightness || 0,
            breakouts: breakouts || 0,
            confidence: confidence || 0,
            hydration: hydration || 0,
            smoothness: smoothness || 0,
            evenness: evenness || 0,
            firmness: firmness || 0,
            glow: glow || 0
          },
          completed: true,
          completedAt: new Date()
        });

        await dailyCheckIn.save();

        // Update streak
        await fetch(`${process.env.CLIENT_URL || 'http://localhost:3000'}/api/mongodb/streak/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: patient._id,
            patientPhone: patient.phone,
            date: date,
            dayOfJourney: day
          })
        }).catch(err => console.log('Streak update failed:', err.message));
      }
    } catch (mongoError) {
      console.log('MongoDB save failed (continuing with Airtable):', mongoError.message);
    }

    res.json({
      success: true,
      id: record[0].id,
      message: 'Skin score saved successfully'
    });
  } catch (error) {
    console.error('Skin score error:', error);
    res.status(500).json({ error: 'Failed to save skin score' });
  }
});

// GET /api/skinscore/:phone - Get skin scores for a patient by phone
router.get('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const records = await base(TABLES.SKIN_SCORES)
      .select({
        filterByFormula: `{Patient Phone} = '${phone}'`,
        sort: [{ field: 'Day', direction: 'asc' }]
      })
      .all();

    const scores = records.map(record => ({
      id: record.id,
      date: record.fields['Date'],
      day: record.fields['Day'],
      texture: record.fields['Texture'],
      pigmentation: record.fields['Pigmentation'],
      brightness: record.fields['Brightness'],
      breakouts: record.fields['Breakouts'],
      confidence: record.fields['Confidence'],
      hydration: record.fields['Hydration'],
      smoothness: record.fields['Smoothness'],
      evenness: record.fields['Evenness'],
      firmness: record.fields['Firmness'],
      glow: record.fields['Glow'],
      totalScore: record.fields['Total Score'],
      photoUrl: record.fields['Photo URL']
    }));

    res.json(scores);
  } catch (error) {
    console.error('Fetch skin scores error:', error);
    res.status(500).json({ error: 'Failed to fetch skin scores' });
  }
});

module.exports = router;
