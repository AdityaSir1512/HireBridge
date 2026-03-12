const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  employerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  type: { type: String, enum: ['phone','video','in_person'], default: 'video' },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  location: { type: String, default: '' },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['scheduled','rescheduled','cancelled','completed'], default: 'scheduled' }
}, { timestamps: true });

module.exports = mongoose.model('Interview', interviewSchema);
