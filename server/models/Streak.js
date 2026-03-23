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
  // Shield system for streak restoration
  shields: {
    monthly: {
      type: Number,
      default: 3,
      min: 0,
      max: 3
    },
    used: {
      type: Number,
      default: 0,
      min: 0
    },
    lastResetMonth: {
      type: String,
      default: () => new Date().toISOString().slice(0, 7) // YYYY-MM format
    }
  },
  // Tracks coach-initiated restorations separately (max 2/month per patient)
  coachShields: {
    used: { type: Number, default: 0, min: 0 },
    lastResetMonth: { type: String, default: () => new Date().toISOString().slice(0, 7) }
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

// Pre-save middleware - temporarily disabled due to next() issue
// streakSchema.pre('save', function(next) {
//   this.updatedAt = Date.now();
//   next();
// });

module.exports = mongoose.model('Streak', streakSchema);
