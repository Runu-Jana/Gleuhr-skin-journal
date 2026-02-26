const mongoose = require('mongoose');

const reorderEventSchema = new mongoose.Schema({
  patientId: {
    type: String,
    trim: true
  },
  patientEmail: {
    type: String,
    required: true,
    trim: true
  },
  day: {
    type: Number,
    required: true
  },
  eventType: {
    type: String,
    default: 'Reorder Banner Click'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

reorderEventSchema.index({ patientEmail: 1 });
reorderEventSchema.index({ timestamp: -1 });

module.exports = mongoose.model('ReorderEvent', reorderEventSchema);
