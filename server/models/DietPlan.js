const mongoose = require('mongoose');

const dietPlanSchema = new mongoose.Schema({
  version: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  restrictions: [{
    type: String
  }],
  recommendations: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
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

dietPlanSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DietPlan', dietPlanSchema);
