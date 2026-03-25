const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const whatsappService = require('../services/whatsappService');
const crypto = require('crypto');

// Validation helpers
const PHONE_RE = /^\d{7,15}$/;
const COUNTRY_CODE_RE = /^\d{1,4}$/;
const OTP_RE = /^\d{4,8}$/;

function validatePhone(phone) {
  const clean = (phone || '').replace(/\D/g, '');
  return PHONE_RE.test(clean) ? clean : null;
}

function validateCountryCode(cc) {
  return COUNTRY_CODE_RE.test((cc || '').toString()) ? cc : null;
}

// POST /api/auth/send-verification - Send WhatsApp verification code to any phone
router.post('/send-verification', async (req, res) => {
  try {
    const { phoneNumber, countryCode } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    if (!validatePhone(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    if (countryCode && !validateCountryCode(countryCode)) {
      return res.status(400).json({ error: 'Invalid country code' });
    }

    // Generate a real random OTP; use fixed code only in development
    const verificationCode = process.env.NODE_ENV === 'development'
      ? '123456'
      : await whatsappService.generateVerificationCode();

    // Store verification code with expiry
    await whatsappService.storeVerificationCode(phoneNumber, verificationCode);

    // Look up customer name from Airtable Diet Plan table (Name lookup field)
    let customerName = null;
    try {
      const { fetchDietPlans } = require('../services/airtableService');
      const plans = await fetchDietPlans({ customerPhone: phoneNumber });
      if (plans && plans.length > 0) {
        customerName = plans[0].customerName || null;
      }
    } catch (atErr) {
      console.warn('Airtable name lookup skipped on send-verification:', atErr.message);
    }

    // Send WhatsApp message
    const result = await whatsappService.sendOTP(phoneNumber, verificationCode, countryCode || '91');

    console.log('WhatsApp service result:', result);

    if (result.success) {
      res.json({
        success: true,
        messageId: result.messageId,
        fallback: result.fallback || false,
        customerName,
        // In development, always return the code for testing
        ...(process.env.NODE_ENV === 'development' && { code: verificationCode })
      });
    } else {
      console.error('WhatsApp OTP sending failed:', result.error || 'Unknown error');
      res.status(500).json({ 
        error: 'Failed to send verification code', 
        details: result.error || 'Unknown error'
      });
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

    if (!validatePhone(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    if (countryCode && !validateCountryCode(countryCode)) {
      return res.status(400).json({ error: 'Invalid country code' });
    }

    // Generate a real random OTP; use fixed code only in development
    const verificationCode = process.env.NODE_ENV === 'development'
      ? '123456'
      : await whatsappService.generateVerificationCode();

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

    if (!validatePhone(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    if (!OTP_RE.test(verificationCode)) {
      return res.status(400).json({ error: 'Invalid verification code format' });
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

    // Fetch Airtable data once — used for both new and existing patients
    let airtableName = '';
    let airtableDietician = '';
    try {
      const { fetchDietPlans } = require('../services/airtableService');
      const plans = await fetchDietPlans({ customerPhone: phoneNumber });
      if (plans && plans.length > 0) {
        airtableName      = plans[0].customerName  || '';
        airtableDietician = plans[0].dieticianName || '';
      }
    } catch (atErr) {
      console.warn('Airtable lookup skipped on login:', atErr.message);
    }

    // Auto-create patient if not found
    if (!patient) {
      isNewUser = true;
      patient = await Patient.create({
        name:         airtableName || 'New Patient',
        fullName:     airtableName || 'New Patient',
        phoneNumber,
        phone:        phoneNumber,
        coachName:    airtableDietician || '',
        startDate:    new Date(),
        isActive:     true,
        hasCommitted: false,
        currentDay:   1,
        totalPoints:  0,
        level:        1,
        achievements: [],
      });
    } else if (airtableName && patient.name !== airtableName) {
      // Existing patient: sync name from Airtable (Airtable is the source of truth for names)
      await Patient.findByIdAndUpdate(patient._id, {
        name: airtableName,
        fullName: airtableName,
      });
      patient.name = airtableName;
      patient.fullName = airtableName;
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
        dietPlan: updatedPatient.dietPlan,
        isNewUser: updatedPatient.isNewUser || false
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

    console.log(`🔑 Verifying token: ${authToken.substring(0, 10)}...`);

    // Find patient by auth token
    const patient = await Patient.findOne({ authToken });

    if (!patient) {
      console.log('❌ Patient not found for token:', authToken);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Optional: Verify device fingerprint matches
    if (deviceFingerprint && patient.deviceFingerprint !== deviceFingerprint) {
      console.log('❌ Device fingerprint mismatch');
      return res.status(401).json({ error: 'Device verification failed' });
    }

    // Update last login
    await Patient.findByIdAndUpdate(patient._id, {
      lastLogin: new Date()
    });

    console.log('✅ Token verification successful for:', patient.name || patient.fullName);

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
        dietPlan: patient.dietPlan || null
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
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
