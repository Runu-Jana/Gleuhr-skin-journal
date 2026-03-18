const mongoose = require('mongoose');

const coachNoteSchema = new mongoose.Schema({
  patientPhone: { type: String, required: true, index: true },
  dieticianName: { type: String, default: '' },
  note: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CoachNote', coachNoteSchema);
