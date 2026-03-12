const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  jobType: { type: String, required: true, enum: ['freelancing', 'full_time', 'internship'] },
  skills: [{ type: String, trim: true }],
  location: { type: String, trim: true },
  salaryMin: { type: Number, default: 0 },
  salaryMax: { type: Number, default: 0 },
  company: {
    name: String,
    logo: String,
    website: String
  },
  employerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  employerType: { type: String, required: true, enum: ['company', 'personal'] },
  status: { type: String, enum: ['draft', 'active', 'closed'], default: 'active', index: true },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' }
}, { timestamps: true });

jobSchema.index({ title: 'text', description: 'text', skills: 1, location: 1, jobType: 1, employerType: 1 });

module.exports = mongoose.model('Job', jobSchema);
