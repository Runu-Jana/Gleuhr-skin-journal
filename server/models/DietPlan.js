const mongoose = require('mongoose');

const dietPlanVersionSchema = new mongoose.Schema({
  category: { type: String, default: '' },
  restrictions: [{ type: String }],
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

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
  notes: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // History of previous versions (oldest first). The current plan fields above
  // represent the latest version; each save pushes the old values here.
  versions: [dietPlanVersionSchema],
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
