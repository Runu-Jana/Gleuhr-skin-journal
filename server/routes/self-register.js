const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const whatsappService = require('../services/whatsappService');
const crypto = require('crypto');

// POST /api/self-register/send-verification - Send verification for self-registration
router.post('/send-verification', async (req, res) => {
  try {
    const { phoneNumber, countryCode, fullName, email } = req.body;
    
    if (!phoneNumber || !fullName) {
      return res.status(400).json({ error: 'Phone number and full name are required' });
    }

    // Check if patient already exists
    const existingPatient = await Patient.findOne({ phoneNumber });
    if (existingPatient) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    // Generate 6-digit verification code
    const verificationCode = await whatsappService.generateVerificationCode();
    
    // Store verification code with expiry
    await whatsappService.storeVerificationCode(phoneNumber, verificationCode);
    
    // Send WhatsApp message
    const result = await whatsappService.sendOTP(phoneNumber, verificationCode, countryCode || '91');
    
    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        // In development, return the code for testing
        ...(process.env.NODE_ENV === 'development' && { code: verificationCode })
      });
    } else {
      res.status(500).json({ error: 'Failed to send verification code' });
    }
  } catch (error) {
    console.error('Send verification error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// POST /api/self-register/complete - Complete self-registration
router.post('/complete', async (req, res) => {
  try {
    const { 
      phoneNumber, 
      verificationCode, 
      deviceFingerprint,
      fullName,
      email,
      skinConcern,
      planType,
      age,
      gender,
      skinType,
      goals
    } = req.body;
    
    if (!phoneNumber || !verificationCode || !fullName) {
      return res.status(400).json({ error: 'Phone number, verification code, and full name are required' });
    }

    // Verify WhatsApp verification code first
    const verificationResult = await whatsappService.verifyCode(phoneNumber, verificationCode);
    
    if (!verificationResult.valid) {
      return res.status(400).json({ error: verificationResult.error });
    }

    // Check if patient already exists (double-check)
    const existingPatient = await Patient.findOne({ phoneNumber });
    if (existingPatient) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    // Generate persistent auth token
    const authToken = crypto.randomBytes(32).toString('hex');
    
    // Create new patient record
    const patient = new Patient({
      // Basic Information
      fullName,
      name: fullName, // Legacy field
      email: email && email.trim() ? email.trim() : undefined, // Only set if provided
      phoneNumber,
      phone: phoneNumber, // Legacy field
      skinConcern: skinConcern || '',
      planType: planType || 'Basic',
      startDate: new Date(),
      
      // Authentication & Security
      authToken,
      deviceFingerprint,
      lastLogin: new Date(),
      
      // Program Status
      hasCommitted: false,
      commitment: 'none',
      isActive: true,
      
      // Progress Tracking
      currentDay: 1,
      completionPercentage: 0,
      
      // Gamification
      totalPoints: 0,
      level: 1,
      achievements: [],
      
      // Profile
      profile: {
        age: age || null,
        gender: gender || '',
        skinType: skinType || '',
        concerns: [],
        goals: goals ? goals.split(',').map(g => g.trim()) : []
      },
      
      // Preferences
      preferences: {
        notifications: true,
        weeklyReminders: true,
        dailyReminders: true
      }
    });
    
    await patient.save();
    
    res.json({
      success: true,
      authToken,
      patient: {
        id: patient._id,
        name: patient.fullName,
        email: patient.email,
        phone: patient.phoneNumber,
        concern: patient.skinConcern,
        planType: patient.planType,
        startDate: patient.startDate,
        hasCommitted: patient.hasCommitted,
        totalPoints: patient.totalPoints,
        level: patient.level,
        achievements: patient.achievements,
        isNewUser: true
      }
    });
  } catch (error) {
    console.error('Self-registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/self-register/commitment - Update patient commitment
router.post('/commitment', async (req, res) => {
  try {
    const { phoneNumber, hasCommitted } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Update patient commitment
    const patient = await Patient.findOneAndUpdate(
      { phoneNumber },
      { 
        hasCommitted: hasCommitted,
        commitment: hasCommitted ? 'basic' : 'none'
      },
      { new: true }
    );

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({
      success: true,
      hasCommitted: patient.hasCommitted
    });
  } catch (error) {
    console.error('Commitment update error:', error);
    res.status(500).json({ error: 'Failed to update commitment' });
  }
});

module.exports = router;
