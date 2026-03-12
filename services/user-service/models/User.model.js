const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  userType: {
    type: String,
    required: true,
    enum: ['job_seeker', 'employer']
  },
  // Job Seeker specific fields
  jobTypePreference: {
    type: String,
    enum: ['freelancer', 'full_time', 'internship'],
    default: null
  },
  // Employer specific fields
  employerType: {
    type: String,
    enum: ['company', 'personal'],
    default: null
  },
  // Profile fields
  profile: {
    location: String,
    phone: String,
    bio: String,
    avatar: String,
    skills: [String],
    experience: [{
      company: String,
      role: String,
      startDate: Date,
      endDate: Date,
      current: Boolean,
      description: String
    }],
    education: [{
      institution: String,
      degree: String,
      field: String,
      startDate: Date,
      endDate: Date
    }],
    portfolio: [{
      title: String,
      description: String,
      url: String
    }],
    availability: {
      type: String,
      enum: ['available', 'busy', 'not_available'],
      default: 'available'
    }
  },
  // Employer profile fields
  companyProfile: {
    companyName: String,
    companyDescription: String,
    industry: String,
    companySize: String,
    website: String,
    logo: String,
    location: String,
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    }
  },
  // Personal employer profile fields
  personalProfile: {
    personalName: String,
    personalBio: String,
    personalWebsite: String,
    personalProjects: [{
      title: String,
      description: String,
      url: String
    }]
  },
  // Theme preference
  themePreference: {
    type: String,
    enum: ['light', 'dark', 'system'],
    default: 'system'
  },
  // Settings
  settings: {
    jobPreferences: {
      preferredJobType: {
        type: String,
        enum: ['full_time', 'freelancing', 'internship', 'any'],
        default: 'any'
      },
      workMode: {
        type: String,
        enum: ['remote', 'onsite', 'hybrid', 'any'],
        default: 'any'
      },
      jobAlerts: {
        type: Boolean,
        default: true
      }
    },
    notifications: {
      emailNotifications: {
        type: Boolean,
        default: true
      },
      applicationUpdates: {
        type: Boolean,
        default: true
      },
      newMessages: {
        type: Boolean,
        default: true
      },
      interviewReminders: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      profileVisibility: {
        type: Boolean,
        default: true
      },
      twoFactorAuth: {
        type: Boolean,
        default: false
      },
      allowRecruiterMessages: {
        type: Boolean,
        default: true
      }
    },
    appearance: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto'
      }
    }
  },
  // CV reference
  cvId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CV',
    default: null
  },
  // Account status
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  deletedAt: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile (without sensitive data)
userSchema.methods.toPublicJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;

