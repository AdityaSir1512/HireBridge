const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, param, validationResult } = require('express-validator');
const CV = require('../models/CV.model');
const { getClient } = require('../config/redis');
const { publishEvent } = require('../config/rabbitmq');
const pdfExtractor = require('../services/pdfExtractor.service');
const aiParser = require('../services/aiParser.service');
const profileUpdater = require('../services/profileUpdate.service');

const router = express.Router();

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, req.cvStorageDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Unsupported file type'));
    cb(null, true);
  }
});

// Upload CV
router.post('/upload', upload.single('cv'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

    const doc = await CV.create({
      userId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      processingStatus: 'pending'
    });

    await publishEvent('cv.uploaded', { cvId: doc._id, userId });
    res.status(201).json({ 
      success: true, 
      cv: doc,
      message: 'CV uploaded successfully. Use /parse-ai endpoint to extract data.'
    });
  } catch (e) {
    console.error('Upload CV error:', e);
    res.status(500).json({ success: false, message: 'Failed to upload CV' });
  }
});

// AI-Powered CV Parsing
router.post('/parse-ai', [
  body('cvId').isString().notEmpty(),
  body('aiModel').optional().isIn(['openai', 'claude', 'huggingface']),
  body('updateProfile').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { cvId, aiModel, updateProfile = true } = req.body;
    const doc = await CV.findById(cvId);
    
    if (!doc) {
      return res.status(404).json({ success: false, message: 'CV not found' });
    }

    // Update status to processing
    doc.processingStatus = 'processing';
    await doc.save();

    try {
      // Step 1: Extract text from PDF
      console.log('Extracting text from PDF...');
      const extractedText = await pdfExtractor.extractAndClean(doc.path);
      doc.extractedText = extractedText;

      // Step 2: Parse with AI
      console.log(`Parsing with AI model: ${aiModel || 'default'}...`);
      const parsedData = await aiParser.parseCV(extractedText, aiModel);
      doc.parsedData = parsedData;
      doc.aiModel = aiModel || aiParser.defaultModel;

      // Step 3: Generate suggestions
      console.log('Generating career suggestions...');
      const suggestions = await aiParser.generateSuggestions(parsedData);
      doc.suggestions = suggestions.jobTypes || [];

      // Step 4: Update processing status
      doc.processingStatus = 'completed';
      doc.summary = parsedData; // Backward compatibility
      await doc.save();

      // Step 5: Update user profile if requested
      let profileUpdateResult = null;
      if (updateProfile) {
        try {
          console.log('Updating user profile...');
          profileUpdateResult = await profileUpdater.updateProfileSmart(
            doc.userId.toString(),
            parsedData,
            req.headers.authorization?.replace('Bearer ', ''),
            true // Smart merge
          );
          doc.profileUpdated = true;
          doc.profileUpdateDate = new Date();
          await doc.save();
        } catch (profileError) {
          console.error('Profile update failed:', profileError.message);
          profileUpdateResult = { 
            success: false, 
            error: profileError.message 
          };
        }
      }

      // Publish events
      await publishEvent('cv.processed', { 
        cvId: doc._id, 
        userId: doc.userId,
        aiModel: doc.aiModel 
      });
      await publishEvent('cv.parsed', { 
        cvId: doc._id, 
        parsedData: parsedData 
      });

      res.json({
        success: true,
        message: 'CV parsed successfully',
        parsedData: doc.parsedData,
        suggestions: suggestions,
        aiModel: doc.aiModel,
        profileUpdate: profileUpdateResult
      });

    } catch (parseError) {
      console.error('CV parsing error:', parseError);
      doc.processingStatus = 'failed';
      doc.processingError = parseError.message;
      await doc.save();
      
      res.status(500).json({ 
        success: false, 
        message: 'Failed to parse CV',
        error: parseError.message 
      });
    }
  } catch (e) {
    console.error('Parse AI error:', e);
    res.status(500).json({ success: false, message: 'Failed to process CV' });
  }
});

// Get CV metadata
router.get('/:cvId', async (req, res) => {
  try {
    const doc = await CV.findById(req.params.cvId);
    if (!doc) return res.status(404).json({ success: false, message: 'CV not found' });
    res.json({ success: true, cv: doc });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get CV' }); }
});

// Get parsed data
router.get('/:cvId/parsed', async (req, res) => {
  try {
    const doc = await CV.findById(req.params.cvId);
    if (!doc) return res.status(404).json({ success: false, message: 'CV not found' });
    
    res.json({ 
      success: true, 
      parsedData: doc.parsedData,
      editedData: doc.editedData,
      isEdited: doc.isEdited,
      processingStatus: doc.processingStatus,
      aiModel: doc.aiModel
    });
  } catch (e) { 
    res.status(500).json({ success: false, message: 'Failed to get parsed data' }); 
  }
});

// Update/Edit parsed data manually
router.put('/:cvId/parsed', [
  body('parsedData').isObject().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const doc = await CV.findById(req.params.cvId);
    if (!doc) return res.status(404).json({ success: false, message: 'CV not found' });
    
    // Store edited data
    doc.editedData = req.body.parsedData;
    doc.isEdited = true;
    await doc.save();

    res.json({ 
      success: true, 
      message: 'Parsed data updated successfully',
      editedData: doc.editedData 
    });
  } catch (e) { 
    console.error('Update parsed data error:', e);
    res.status(500).json({ success: false, message: 'Failed to update parsed data' }); 
  }
});

// Apply edited/parsed data to user profile
router.post('/:cvId/apply-to-profile', [
  body('useEdited').optional().isBoolean()
], async (req, res) => {
  try {
    const { useEdited = true } = req.body;
    const doc = await CV.findById(req.params.cvId);
    
    if (!doc) {
      return res.status(404).json({ success: false, message: 'CV not found' });
    }

    // Use edited data if available and requested, otherwise use parsed data
    const dataToApply = (useEdited && doc.editedData) ? doc.editedData : doc.parsedData;
    
    if (!dataToApply) {
      return res.status(400).json({ 
        success: false, 
        message: 'No parsed data available. Please parse the CV first using /parse-ai endpoint.' 
      });
    }

    try {
      const result = await profileUpdater.updateProfileSmart(
        doc.userId.toString(),
        dataToApply,
        req.headers.authorization?.replace('Bearer ', ''),
        true // Smart merge
      );

      doc.profileUpdated = true;
      doc.profileUpdateDate = new Date();
      await doc.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        profileUpdate: result
      });
    } catch (updateError) {
      console.error('Profile update error:', updateError);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update profile',
        error: updateError.message 
      });
    }
  } catch (e) {
    console.error('Apply to profile error:', e);
    res.status(500).json({ success: false, message: 'Failed to apply data to profile' });
  }
});

// Get extracted text
router.get('/:cvId/text', async (req, res) => {
  try {
    const doc = await CV.findById(req.params.cvId);
    if (!doc) return res.status(404).json({ success: false, message: 'CV not found' });
    
    res.json({ 
      success: true, 
      extractedText: doc.extractedText,
      filename: doc.originalName
    });
  } catch (e) { 
    res.status(500).json({ success: false, message: 'Failed to get extracted text' }); 
  }
});

// Get CV summary (cached)
router.get('/:cvId/summary', async (req, res) => {
  try {
    const redis = getClient();
    const cacheKey = `cv:summary:${req.params.cvId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ success: true, summary: JSON.parse(cached) });

    const doc = await CV.findById(req.params.cvId);
    if (!doc) return res.status(404).json({ success: false, message: 'CV not found' });

    await redis.setEx(cacheKey, 86400, JSON.stringify(doc.summary || {}));
    res.json({ success: true, summary: doc.summary || {} });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get summary' }); }
});

// Analyze CV (stub)
router.post('/analyze', [ body('cvId').isString().notEmpty() ], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const doc = await CV.findById(req.body.cvId);
    if (!doc) return res.status(404).json({ success: false, message: 'CV not found' });

    // Stub summary
    const summary = {
      personal: {},
      skills: ['JavaScript','Node.js'],
      experience: [],
      education: [],
      certifications: [],
      projects: []
    };
    doc.summary = summary;

    // Stub suggestions based on skills
    doc.suggestions = ['full_time', 'freelancing'];
    await doc.save();

    await publishEvent('cv.processed', { cvId: doc._id, userId: doc.userId });
    await publishEvent('cv.summary.generated', { cvId: doc._id });
    await publishEvent('cv.suggestions.generated', { cvId: doc._id, suggestions: doc.suggestions });

    res.json({ success: true, summary: doc.summary, suggestions: doc.suggestions });
  } catch (e) {
    console.error('Analyze CV error:', e);
    res.status(500).json({ success: false, message: 'Failed to analyze CV' });
  }
});

// Get user's CVs
router.get('/user/:userId', async (req, res) => {
  try {
    const list = await CV.find({ userId: req.params.userId }).sort({ createdAt: -1 }).limit(5);
    res.json({ success: true, cvs: list });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get user CVs' }); }
});

// Get suggestions (cached)
router.get('/:cvId/suggestions', async (req, res) => {
  try {
    const redis = getClient();
    const key = `cv:suggestions:${req.params.cvId}`;
    const cached = await redis.get(key);
    if (cached) return res.json({ success: true, suggestions: JSON.parse(cached) });

    const doc = await CV.findById(req.params.cvId);
    if (!doc) return res.status(404).json({ success: false, message: 'CV not found' });

    await redis.setEx(key, 3600, JSON.stringify(doc.suggestions || []));
    res.json({ success: true, suggestions: doc.suggestions || [] });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get suggestions' }); }
});

// Update CV metadata
router.put('/:cvId', async (req, res) => {
  try {
    const doc = await CV.findByIdAndUpdate(req.params.cvId, req.body, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'CV not found' });
    res.json({ success: true, cv: doc });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to update CV' }); }
});

// Delete CV
router.delete('/:cvId', async (req, res) => {
  try {
    const doc = await CV.findById(req.params.cvId);
    if (!doc) return res.status(404).json({ success: false, message: 'CV not found' });
    try { fs.unlinkSync(doc.path); } catch {}
    await doc.deleteOne();
    res.json({ success: true, message: 'CV deleted' });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to delete CV' }); }
});

module.exports = router;
