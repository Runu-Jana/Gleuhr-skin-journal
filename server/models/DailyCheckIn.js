const mongoose = require('mongoose');

const dailyCheckInSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    ref: 'Patient'
  },
  patientPhone: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  dayOfJourney: {
    type: Number,
    required: true
  },
  skinScore: {
    type: Number,
    required: true,
    min: 0,
    max: 20
  },
  skinScores: {
    texture: { type: Number, min: 0, max: 2 },
    pigmentation: { type: Number, min: 0, max: 2 },
    brightness: { type: Number, min: 0, max: 2 },
    breakouts: { type: Number, min: 0, max: 2 },
    confidence: { type: Number, min: 0, max: 2 },
    hydration: { type: Number, min: 0, max: 2 },
    smoothness: { type: Number, min: 0, max: 2 },
    evenness: { type: Number, min: 0, max: 2 },
    firmness: { type: Number, min: 0, max: 2 },
    glow: { type: Number, min: 0, max: 2 }
  },
  mood: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor'],
    default: 'good'
  },
  energy: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  sleep: {
    type: Number,
    min: 0,
    max: 12,
    default: 8
  },
  waterIntake: {
    type: Number,
    min: 0,
    max: 20,
    default: 8
  },
  medications: [{
    name: String,
    taken: Boolean,
    time: Date
  }],
  notes: {
    type: String,
    default: ''
  },
  symptoms: [{
    type: String
  }],
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

dailyCheckInSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
dailyCheckInSchema.index({ patientId: 1, date: 1 }, { unique: true });
dailyCheckInSchema.index({ patientId: 1, dayOfJourney: 1 });

module.exports = mongoose.model('DailyCheckIn', dailyCheckInSchema);
