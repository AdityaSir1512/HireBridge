const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  employerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  applicantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  coverLetter: { type: String, default: '' },
  resumeUrl: { type: String, default: '' },
  status: { type: String, enum: ['submitted','review','shortlisted','interview','rejected','hired'], default: 'submitted' },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Application', applicationSchema);
