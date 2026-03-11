const mongoose = require('mongoose');

const skinScoreSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  day: {
    type: Number,
    required: true,
    min: 1,
    max: 90
  },
  
  // Skin assessment metrics (1-5 scale for new 4-question format)
  darkest_patch: {
    type: Number,
    min: 0,
    max: 5,
    default: 3
  },
  skin_tone: {
    type: Number,
    min: 0,
    max: 5,
    default: 3
  },
  texture: {
    type: Number,
    min: 0,
    max: 5,
    default: 3
  },
  confidence: {
    type: Number,
    min: 0,
    max: 5,
    default: 3
  },
  
  // Calculated total score (0-20 for new format)
  totalScore: {
    type: Number,
    min: 0,
    max: 20,
    default: 12
  },
  
  // Photo evidence
  photoUrl: {
    type: String,
    trim: true
  },
  
  // Additional notes
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Sync status
  synced: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate total score before saving
skinScoreSchema.pre('save', async function() {
  this.totalScore = (this.darkest_patch || 0) + (this.skin_tone || 0) + (this.texture || 0) + (this.confidence || 0);
  this.updatedAt = Date.now();
});

// Indexes for better performance
skinScoreSchema.index({ patient: 1, date: -1 });
skinScoreSchema.index({ phoneNumber: 1, date: -1 });
skinScoreSchema.index({ day: 1 });

module.exports = mongoose.model('SkinScore', skinScoreSchema);
