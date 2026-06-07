const express = require('express');
const router = express.Router();
const MealPhoto = require('../models/MealPhoto');
const Patient = require('../models/Patient');

// POST /api/meal-photo — upload or replace a meal photo (upsert per patient+date+type)
router.post('/', async (req, res) => {
  try {
    const { patientPhone, mealType, mealDate, photoData, photoUrl, notes, tags, day } = req.body;

    if (!patientPhone) {
      return res.status(400).json({ error: 'Missing patientPhone' });
    }
    if (!mealType || !['breakfast', 'lunch', 'dinner'].includes(mealType)) {
      return res.status(400).json({ error: 'mealType must be breakfast, lunch, or dinner' });
    }
    if (!photoData && !photoUrl) {
      return res.status(400).json({ error: 'Missing photo data' });
    }

    const patient = await Patient.findOne({
      $or: [{ phoneNumber: patientPhone }, { phone: patientPhone }]
    });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const today = mealDate || new Date().toISOString().split('T')[0];
    const pid = patient._id.toString();
    const pPhone = patient.phone || patient.phoneNumber;

    const photo = await MealPhoto.findOneAndUpdate(
      { patientId: pid, mealDate: today, mealType },
      {
        $set: {
          patientPhone: pPhone,
          photoUrl: photoUrl || '',
          photoData: photoData || '',
          dayOfJourney: day || 1,
          notes: notes || '',
          tags: tags || [mealType, today],
          updatedAt: new Date()
        },
        $setOnInsert: {
          patientId: pid,
          mealDate: today,
          mealType,
          createdAt: new Date()
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, id: photo._id, message: 'Meal photo saved' });
  } catch (error) {
    console.error('Meal photo upload error:', error);
    res.status(500).json({ error: 'Failed to save meal photo' });
  }
});

// GET /api/meal-photo/:phone — all meal photos for a patient
router.get('/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const patient = await Patient.findOne({
      $or: [{ phoneNumber: phone }, { phone }]
    });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const photos = await MealPhoto.find({
      $or: [{ patientId: patient._id.toString() }, { patientPhone: phone }]
    }).sort({ mealDate: -1, mealType: 1 });

    res.json(photos.map(p => ({
      id: p._id,
      mealType: p.mealType,
      mealDate: p.mealDate,
      photoUrl: p.photoUrl,
      photoData: p.photoData,
      dayOfJourney: p.dayOfJourney,
      notes: p.notes,
      createdAt: p.createdAt
    })));
  } catch (error) {
    console.error('Fetch meal photos error:', error);
    res.status(500).json({ error: 'Failed to fetch meal photos' });
  }
});

// GET /api/meal-photo/:phone/date/:date — meal photos for a specific date
router.get('/:phone/date/:date', async (req, res) => {
  try {
    const { phone, date } = req.params;
    const patient = await Patient.findOne({
      $or: [{ phoneNumber: phone }, { phone }]
    });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const photos = await MealPhoto.find({
      $or: [{ patientId: patient._id.toString() }, { patientPhone: phone }],
      mealDate: date
    }).sort({ mealType: 1 });

    res.json(photos.map(p => ({
      id: p._id,
      mealType: p.mealType,
      mealDate: p.mealDate,
      photoUrl: p.photoUrl,
      photoData: p.photoData,
      dayOfJourney: p.dayOfJourney,
      notes: p.notes,
      createdAt: p.createdAt
    })));
  } catch (error) {
    console.error('Fetch meal photos error:', error);
    res.status(500).json({ error: 'Failed to fetch meal photos' });
  }
});

module.exports = router;
