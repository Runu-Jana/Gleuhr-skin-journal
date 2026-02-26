const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const whatsappService = require('../services/whatsappService');
const crypto = require('crypto');

// POST /api/auth/send-verification - Send WhatsApp verification code to any phone
router.post('/send-verification', async (req, res) => {
  try {
    const { phoneNumber, countryCode } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
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

// POST /api/auth/resend-verification - Resend WhatsApp verification code
router.post('/resend-verification', async (req, res) => {
  try {
    const { phoneNumber, countryCode } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Generate new verification code
    const verificationCode = await whatsappService.generateVerificationCode();

    // Store new verification code with expiry
    await whatsappService.storeVerificationCode(phoneNumber, verificationCode);

    // Send WhatsApp message
    const result = await whatsappService.resendOTP(phoneNumber, verificationCode, countryCode || '91');

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        resent: true,
        // In development, return the code for testing
        ...(process.env.NODE_ENV === 'development' && { code: verificationCode })
      });
    } else {
      res.status(500).json({ error: 'Failed to resend verification code' });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
});

// POST /api/auth/register - Verify code, auto-create patient if new, then login
router.post('/register', async (req, res) => {
  try {
    const { phoneNumber, verificationCode, deviceFingerprint } = req.body;

    if (!phoneNumber || !verificationCode) {
      return res.status(400).json({ error: 'Phone number and verification code are required' });
    }

    // Verify WhatsApp verification code first
    const verificationResult = await whatsappService.verifyCode(phoneNumber, verificationCode);

    if (!verificationResult.valid) {
      return res.status(400).json({ error: verificationResult.error });
    }

    // Find patient by phone number
    let patient = await Patient.findOne({
      $or: [{ phoneNumber }, { phone: phoneNumber }]
    });

    let isNewUser = false;

    // Auto-create patient if not found
    if (!patient) {
      isNewUser = true;
      patient = new Patient({
        fullName: phoneNumber,
        name: phoneNumber,
        phoneNumber,
        phone: phoneNumber,
        startDate: new Date(),
        hasCommitted: false,
        isActive: true,
        currentDay: 1,
        completionPercentage: 0,
        totalPoints: 0,
        level: 1,
        achievements: [],
        planType: 'Basic',
        preferences: {
          notifications: true,
          weeklyReminders: true,
          dailyReminders: true
        }
      });
      await patient.save();
    }

    // Generate persistent auth token (90 days)
    const authToken = crypto.randomBytes(32).toString('hex');

    // Update patient with auth token and device info
    await Patient.findByIdAndUpdate(patient._id, {
      authToken,
      deviceFingerprint,
      lastLogin: new Date()
    });

    // Get updated patient data
    const updatedPatient = await Patient.findById(patient._id)
      .populate('dietPlan')
      .populate('products');

    res.json({
      success: true,
      authToken,
      isNewUser,
      patient: {
        id: updatedPatient._id,
        name: updatedPatient.name || updatedPatient.fullName,
        email: updatedPatient.email || '',
        phone: updatedPatient.phone || updatedPatient.phoneNumber,
        concern: updatedPatient.skinConcern,
        planType: updatedPatient.planType,
        startDate: updatedPatient.startDate,
        coachName: updatedPatient.coachName,
        coachWhatsApp: updatedPatient.coachWhatsApp,
        hasCommitted: updatedPatient.hasCommitted,
        totalPoints: updatedPatient.totalPoints,
        level: updatedPatient.level,
        achievements: updatedPatient.achievements,
        products: updatedPatient.products || [],
        dietPlan: updatedPatient.dietPlan
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/verify-token - Auto-login with stored token
router.post('/verify-token', async (req, res) => {
  try {
    const { authToken, deviceFingerprint } = req.body;

    if (!authToken) {
      return res.status(400).json({ error: 'Auth token is required' });
    }

    // Find patient by auth token
    const patient = await Patient.findOne({ authToken })
      .populate('dietPlan')
      .populate('products');

    if (!patient) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Optional: Verify device fingerprint matches
    if (deviceFingerprint && patient.deviceFingerprint !== deviceFingerprint) {
      return res.status(401).json({ error: 'Device verification failed' });
    }

    // Update last login
    await Patient.findByIdAndUpdate(patient._id, {
      lastLogin: new Date()
    });

    res.json({
      success: true,
      patient: {
        id: patient._id,
        name: patient.name || patient.fullName,
        email: patient.email || '',
        phone: patient.phone || patient.phoneNumber,
        concern: patient.skinConcern,
        planType: patient.planType,
        startDate: patient.startDate,
        coachName: patient.coachName,
        coachWhatsApp: patient.coachWhatsApp,
        hasCommitted: patient.hasCommitted,
        totalPoints: patient.totalPoints,
        level: patient.level,
        achievements: patient.achievements,
        products: patient.products || [],
        dietPlan: patient.dietPlan
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// POST /api/auth/token - Legacy endpoint (MongoDB-based)
router.post('/token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find patient by journal token in MongoDB
    const patient = await Patient.findOne({ journalToken: token })
      .populate('dietPlan')
      .populate('products');

    if (!patient) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({
      id: patient._id,
      name: patient.name || patient.fullName || '',
      email: patient.email || '',
      concern: patient.skinConcern || '',
      planType: patient.planType || '',
      startDate: patient.startDate || new Date().toISOString().split('T')[0],
      coachName: patient.coachName || '',
      coachWhatsApp: patient.coachWhatsApp || '',
      hasCommitted: patient.hasCommitted || false,
      token: token,
      products: (patient.products || []).map(p => ({
        id: p._id,
        name: p.name || '',
        category: p.category || '',
        instructions: p.instructions || ''
      })),
      dietPlan: patient.dietPlan || null
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;
