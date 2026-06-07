const mongoose = require('mongoose');

const mealPhotoSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    ref: 'Patient'
  },
  patientPhone: {
    type: String,
    required: true
  },
  mealDate: {
    type: String, // YYYY-MM-DD
    required: true
  },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner'],
    required: true
  },
  photoUrl: {
    type: String,
    default: ''
  },
  photoData: {
    type: String,
    default: ''
  },
  dayOfJourney: {
    type: Number,
    default: 1
  },
  notes: {
    type: String,
    default: ''
  },
  tags: [{ type: String }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

mealPhotoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

mealPhotoSchema.index({ patientId: 1, mealDate: 1, mealType: 1 }, { unique: true });

module.exports = mongoose.model('MealPhoto', mealPhotoSchema);
