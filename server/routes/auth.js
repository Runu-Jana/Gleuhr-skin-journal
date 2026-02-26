const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const whatsappService = require('../services/whatsappService');
const crypto = require('crypto');
const { base, TABLES } = require('../config/airtable');

// POST /api/auth/send-verification - Send WhatsApp verification code
router.post('/send-verification', async (req, res) => {
  try {
    const { phoneNumber, countryCode } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Check if patient exists
    const patient = await Patient.findOne({ phoneNumber });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found. Please contact your coach.' });
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

// POST /api/auth/register - Register patient with WhatsApp verification
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
    const patient = await Patient.findOne({ phoneNumber });
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
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
      patient: {
        id: updatedPatient._id,
        name: updatedPatient.name || updatedPatient.fullName,
        email: updatedPatient.email || '', // Handle optional email
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
        email: patient.email || '', // Handle optional email
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

// Helper: Get patient products from Airtable
async function getPatientProducts(patientId) {
  try {
    const records = await base(TABLES.PRODUCTS)
      .select({
        filterByFormula: `SEARCH("${patientId}", {Patient ID})`,
      })
      .firstPage();
    return records.map(r => ({
      id: r.id,
      name: r.fields['Product Name'] || '',
      category: r.fields['Category'] || '',
      instructions: r.fields['Instructions'] || ''
    }));
  } catch (error) {
    console.error('Error fetching patient products:', error.message);
    return [];
  }
}

// Helper: Get diet plan from Airtable
async function getDietPlan(dietPlanIds) {
  try {
    if (!dietPlanIds || dietPlanIds.length === 0) return null;
    const records = await base(TABLES.DIET_PLANS)
      .select({
        filterByFormula: `RECORD_ID() = '${dietPlanIds[0]}'`,
        maxRecords: 1
      })
      .firstPage();
    if (records.length === 0) return null;
    const fields = records[0].fields;
    return {
      id: records[0].id,
      version: fields['Version'] || '',
      category: fields['Category'] || '',
      restrictions: fields['Restrictions'] || '',
      recommendations: fields['Recommendations'] || ''
    };
  } catch (error) {
    console.error('Error fetching diet plan:', error.message);
    return null;
  }
}

// POST /api/auth/token - Legacy endpoint for backward compatibility
router.post('/token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find patient by journal token
    const records = await base(TABLES.PATIENTS)
      .select({
        filterByFormula: `{Journal Token} = '${token}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const patient = records[0];
    const fields = patient.fields;

    // Get products for this patient
    const products = await getPatientProducts(patient.id);

    // Get diet plan
    const dietPlan = await getDietPlan(fields['Diet Plan'] ? [fields['Diet Plan']] : []);

    res.json({
      id: patient.id,
      name: fields['Full Name'] || '',
      email: fields['Email'] || '',
      concern: fields['Skin Concern'] || '',
      planType: fields['Plan Type'] || '',
      startDate: fields['Start Date'] || new Date().toISOString().split('T')[0],
      coachName: fields['Coach Name'] || '',
      coachWhatsApp: fields['Coach WhatsApp'] || '',
      hasCommitted: fields['Has Committed'] || false,
      token: token,
      products,
      dietPlan
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Helper to generate device fingerprint
function generateDeviceFingerprint() {
  return require('crypto')
    .createHash('sha256')
    .update(require('os').hostname() + Date.now())
    .digest('hex');
}

module.exports = router;
