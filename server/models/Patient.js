const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  // Legacy Airtable ID for migration
  airtableId: {
    type: String,
    sparse: true,
    unique: true
  },
  
  // Basic Information - Matching Airtable 'Contacts' table fields
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
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
    required: true,
    unique: true,
    trim: true
  },
  skinConcern: {
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
  
  // Coach Information - From Airtable 'Contacts' table
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
  
  // Legacy Fields (for backward compatibility)
  name: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
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
  lastLogin: {
    type: Date,
    default: Date.now
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

patientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
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
