const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Alternative name field for compatibility
  fullName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true // Allows multiple null/undefined values
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  skinConcern: {
    type: String,
    trim: true
  },
  // Alias for compatibility with frontend
  concern: {
    type: String,
    trim: true
  },
  planType: {
    type: String,
    enum: ['Basic', 'Premium', 'Advanced'],
    default: 'Basic'
  },
  startDate: {
    type: Date,
    required: true
  },
  
  // Coach Information
  coachName: {
    type: String,
    trim: true
  },
  coachWhatsApp: {
    type: String,
    trim: true
  },
  
  // Authentication & Security
  authToken: {
    type: String,
    sparse: true
  },
  deviceFingerprint: {
    type: String,
    sparse: true
  },
  lastLogin: {
    type: Date
  },
  journalToken: {
    type: String,
    sparse: true,
    unique: true
  },
  
  // Program Status
  hasCommitted: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Progress Tracking
  currentDay: {
    type: Number,
    default: 1,
    min: 1,
    max: 90
  },
  completionPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Gamification
  totalPoints: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  achievements: [{
    id: String,
    title: String,
    description: String,
    points: Number,
    icon: String,
    unlockedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Relationships
  dietPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DietPlan'
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  profile: {
    age: Number,
    gender: String,
    skinType: String,
    concerns: [String],
    goals: [String]
  },
  preferences: {
    notifications: {
      type: Boolean,
      default: true
    },
    weeklyReminders: {
      type: Boolean,
      default: true
    },
    dailyReminders: {
      type: Boolean,
      default: true
    }
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

// Keep phone and phoneNumber in sync
patientSchema.pre('save', async function() {
  if (this.phoneNumber && !this.phone) {
    this.phone = this.phoneNumber;
  } else if (this.phone && !this.phoneNumber) {
    this.phoneNumber = this.phone;
  }
});

// Virtuals
patientSchema.virtual('progressPercentage').get(function() {
  if (!this.startDate) return 0;
  const daysElapsed = Math.floor((Date.now() - this.startDate) / (1000 * 60 * 60 * 24));
  return Math.min(Math.round((daysElapsed / 90) * 100), 100);
});

// Indexes for performance (only for fields that don't have index: true in schema)
patientSchema.index({ createdAt: -1 });
patientSchema.index({ currentDay: 1 });
patientSchema.index({ isActive: 1 });

module.exports = mongoose.model('Patient', patientSchema);
