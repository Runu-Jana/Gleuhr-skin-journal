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
  
  // Skin assessment metrics (0-10 scale)
  texture: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  pigmentation: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  brightness: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  breakouts: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  confidence: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  hydration: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  smoothness: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  evenness: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  firmness: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  glow: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  
  // Calculated total score (0-100)
  totalScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
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
skinScoreSchema.pre('save', function(next) {
  const metrics = [
    this.texture,
    this.pigmentation,
    this.brightness,
    this.breakouts,
    this.confidence,
    this.hydration,
    this.smoothness,
    this.evenness,
    this.firmness,
    this.glow
  ];
  
  this.totalScore = Math.round(metrics.reduce((sum, val) => sum + val, 0) / metrics.length * 10);
  this.updatedAt = Date.now();
  next();
});

// Indexes for better performance
skinScoreSchema.index({ patient: 1, date: -1 });
skinScoreSchema.index({ phoneNumber: 1, date: -1 });
skinScoreSchema.index({ day: 1 });

module.exports = mongoose.model('SkinScore', skinScoreSchema);
