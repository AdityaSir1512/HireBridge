const mongoose = require('mongoose');

const cvSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  path: { type: String, required: true },
  
  // AI Processing fields
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  aiModel: { type: String }, // Which AI model was used (openai, claude, huggingface)
  extractedText: { type: String }, // Raw extracted text from PDF
  
  // Parsed data from AI
  parsedData: {
    personal: {
      name: String,
      email: String,
      phone: String,
      location: String,
      linkedin: String,
      github: String,
      portfolio: String,
      summary: String
    },
    skills: {
      technical: [String],
      soft: [String],
      languages: [String],
      tools: [String]
    },
    skillsList: [String], // Flattened list of all skills
    experience: [{
      company: String,
      role: String,
      location: String,
      startDate: String,
      endDate: String,
      current: Boolean,
      description: String,
      achievements: [String]
    }],
    education: [{
      institution: String,
      degree: String,
      field: String,
      location: String,
      startDate: String,
      endDate: String,
      gpa: String,
      achievements: [String]
    }],
    certifications: [{
      name: String,
      issuer: String,
      date: String,
      expiryDate: String,
      credentialId: String
    }],
    projects: [{
      name: String,
      description: String,
      technologies: [String],
      url: String,
      date: String
    }],
    awards: [{
      name: String,
      issuer: String,
      date: String,
      description: String
    }],
    publications: [{
      title: String,
      publisher: String,
      date: String,
      url: String
    }]
  },
  
  // User can edit parsed data
  editedData: { type: Object }, // User's manual edits
  isEdited: { type: Boolean, default: false },
  
  // Profile update status
  profileUpdated: { type: Boolean, default: false },
  profileUpdateDate: { type: Date },
  
  // Legacy fields (keeping for backward compatibility)
  summary: { type: Object, default: null },
  suggestions: [{ type: String }],
  
  // Error tracking
  processingError: { type: String }
}, { timestamps: true });

// Index for faster queries
cvSchema.index({ userId: 1, processingStatus: 1 });
cvSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('CV', cvSchema);
