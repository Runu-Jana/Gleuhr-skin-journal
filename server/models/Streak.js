const mongoose = require('mongoose');

const streakSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    ref: 'Patient'
  },
  patientPhone: {
    type: String,
    required: true
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastCheckIn: {
    type: Date,
    default: null
  },
  checkInDates: [{
    date: Date,
    completed: Boolean,
    checkInTime: Date
  }],
  milestones: [{
    streak: Number,
    achieved: Boolean,
    achievedDate: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

streakSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Streak', streakSchema);
