const mongoose = require('mongoose');

const weeklyPhotoSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    ref: 'Patient'
  },
  patientPhone: {
    type: String,
    required: true
  },
  weekNumber: {
    type: Number,
    required: true
  },
  photoUrl: {
    type: String,
    required: true
  },
  photoData: {
    type: String, // Base64 encoded image data
    default: ''
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  dayOfJourney: {
    type: Number,
    required: true
  },
  skinScore: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  },
  tags: [{
    type: String
  }],
  isPublic: {
    type: Boolean,
    default: false
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

weeklyPhotoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
weeklyPhotoSchema.index({ patientId: 1, weekNumber: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyPhoto', weeklyPhotoSchema);
