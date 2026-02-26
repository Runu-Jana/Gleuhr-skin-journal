const express = require('express');
const router = express.Router();
const WeeklyPhoto = require('../models/WeeklyPhoto');
const Patient = require('../models/Patient');

// Get weekly photos for a patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 10, page = 1 } = req.query;
    
    const photos = await WeeklyPhoto.find({ patientId })
      .sort({ weekNumber: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await WeeklyPhoto.countDocuments({ patientId });
    
    res.json({
      success: true,
      data: photos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching weekly photos:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch weekly photos' });
  }
});

// Upload weekly photo
router.post('/upload', async (req, res) => {
  try {
    const {
      patientId,
      patientPhone,
      weekNumber,
      photoData,
      photoUrl,
      dayOfJourney,
      skinScore,
      notes,
      tags
    } = req.body;
    
    // Check if photo for this week already exists
    const existingPhoto = await WeeklyPhoto.findOne({ patientId, weekNumber });
    
    if (existingPhoto) {
      // Update existing photo
      existingPhoto.photoData = photoData;
      existingPhoto.photoUrl = photoUrl;
      existingPhoto.dayOfJourney = dayOfJourney;
      existingPhoto.skinScore = skinScore;
      existingPhoto.notes = notes || '';
      existingPhoto.tags = tags || [];
      existingPhoto.uploadDate = new Date();
      
      await existingPhoto.save();
      res.json({ success: true, data: existingPhoto });
    } else {
      // Get patient phone if not provided
      let phone = patientPhone || '';
      if (!phone) {
        const patient = await Patient.findById(patientId);
        phone = patient ? patient.phone : '';
      }
      
      // Create new photo record
      const newPhoto = new WeeklyPhoto({
        patientId,
        patientPhone: phone,
        weekNumber,
        photoData,
        photoUrl,
        dayOfJourney,
        skinScore,
        notes: notes || '',
        tags: tags || []
      });
      
      await newPhoto.save();
      res.json({ success: true, data: newPhoto });
    }
  } catch (error) {
    console.error('Error uploading weekly photo:', error);
    res.status(500).json({ success: false, error: 'Failed to upload weekly photo' });
  }
});

// Get specific weekly photo
router.get('/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;
    
    const photo = await WeeklyPhoto.findById(photoId);
    
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }
    
    res.json({ success: true, data: photo });
  } catch (error) {
    console.error('Error fetching photo:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch photo' });
  }
});

// Delete weekly photo
router.delete('/:photoId', async (req, res) => {
  try {
    const { photoId } = req.params;
    
    const photo = await WeeklyPhoto.findByIdAndDelete(photoId);
    
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }
    
    res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ success: false, error: 'Failed to delete photo' });
  }
});

// Get weekly photo statistics
router.get('/stats/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const stats = await WeeklyPhoto.aggregate([
      { $match: { patientId } },
      {
        $group: {
          _id: null,
          totalPhotos: { $sum: 1 },
          averageSkinScore: { $avg: '$skinScore' },
          latestWeek: { $max: '$weekNumber' },
          latestDay: { $max: '$dayOfJourney' }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalPhotos: 0,
      averageSkinScore: 0,
      latestWeek: 0,
      latestDay: 0
    };
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching photo stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch photo statistics' });
  }
});

module.exports = router;
