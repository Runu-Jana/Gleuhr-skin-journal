const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { base, TABLES } = require('../config/airtable');
const whatsappService = require('../services/whatsappService');
const Patient = require('../models/Patient');

// In-memory OTP storage (in production, use Redis)
const otpStore = new Map();

// OTP expiry time (5 minutes)
const OTP_EXPIRY_MS = 5 * 60 * 1000;

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP endpoint
router.post('/send-otp', async (req, res) => {
  try {
    const { phone, countryCode } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Extract country code from phone or use provided country code
    let extractedCountryCode = '91'; // Default to India
    let cleanPhone = phone.replace(/\s/g, '');

    // If country code is provided in request, use it
    if (countryCode) {
      extractedCountryCode = countryCode.replace(/\D/g, '');
      // Remove country code from phone if it's included (with or without +)
      const phoneWithCountryCode = `+${extractedCountryCode}`;
      const phoneWithoutCountryCode = extractedCountryCode;
      
      if (cleanPhone.startsWith(phoneWithCountryCode)) {
        cleanPhone = cleanPhone.substring(phoneWithCountryCode.length);
      } else if (cleanPhone.startsWith(phoneWithoutCountryCode)) {
        cleanPhone = cleanPhone.substring(phoneWithoutCountryCode.length);
      }
    } else {
      // Extract country code from phone if present
      const phoneRegex = /^([+]?[0-9]{1,3})([0-9]{10,15})$/;
      const match = cleanPhone.match(phoneRegex);
      if (match) {
        extractedCountryCode = match[1].replace('+', '');
        cleanPhone = match[2];
      }
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Check if patient exists in Diet Plan table
    const dietPlanTable = base(TABLES.DIET_PLANS);
    const records = await dietPlanTable.select({
      filterByFormula: `{Phone Number} = '${extractedCountryCode}${cleanPhone}'`,
      maxRecords: 1
    }).firstPage();

    // Patient exists flag - true if found, false if new user
    const isExistingPatient = records.length > 0;

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiry and patient status
    otpStore.set(`${extractedCountryCode}${cleanPhone}`, {
      otp,
      expiry: Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
      isNewPatient: !isExistingPatient
    });

    // Send OTP via WhatsApp using Interakt with country code
    const whatsappResult = await whatsappService.sendOTP(cleanPhone, otp, extractedCountryCode);
    
    if (!whatsappResult.success && !whatsappResult.fallback) {
      console.error('WhatsApp OTP failed:', whatsappResult.error);
      return res.status(500).json({ error: 'Failed to send OTP via WhatsApp' });
    }

    // Log fallback usage
    if (whatsappResult.fallback) {
      console.log('Using fallback OTP delivery due to WhatsApp service failure');
    }

    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      isNewPatient: !isExistingPatient,
      // Only in development: return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp })
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to send OTP', details: error.message });
  }
});

// Resend OTP endpoint
router.post('/resend-otp', async (req, res) => {
  try {
    const { phone, countryCode } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Extract country code from phone or use provided country code
    let extractedCountryCode = '91'; // Default to India
    let cleanPhone = phone.replace(/\s/g, '');

    // If country code is provided in request, use it
    if (countryCode) {
      extractedCountryCode = countryCode.replace(/\D/g, '');
      // Remove country code from phone if it's included (with or without +)
      const phoneWithCountryCode = `+${extractedCountryCode}`;
      const phoneWithoutCountryCode = extractedCountryCode;
      
      if (cleanPhone.startsWith(phoneWithCountryCode)) {
        cleanPhone = cleanPhone.substring(phoneWithCountryCode.length);
      } else if (cleanPhone.startsWith(phoneWithoutCountryCode)) {
        cleanPhone = cleanPhone.substring(phoneWithoutCountryCode.length);
      }
    } else {
      // Extract country code from phone if present
      const phoneRegex = /^([+]?[0-9]{1,3})([0-9]{10,15})$/;
      const match = cleanPhone.match(phoneRegex);
      if (match) {
        extractedCountryCode = match[1].replace('+', '');
        cleanPhone = match[2];
      }
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Check if there's an existing OTP request for this number
    const existingData = otpStore.get(`${extractedCountryCode}${cleanPhone}`);
    if (!existingData) {
      return res.status(400).json({ error: 'No previous OTP request found. Please request a new OTP.' });
    }

    // Check if user can request resend (avoid spam)
    const now = Date.now();
    const timeSinceLastRequest = now - (existingData.lastResendRequest || 0);
    if (timeSinceLastRequest < 30000) { // 30 seconds cooldown
      return res.status(400).json({ error: 'Please wait before requesting another OTP.' });
    }

    // Generate new OTP
    const otp = generateOTP();
    
    // Update OTP store with new OTP and resend timestamp
    otpStore.set(`${extractedCountryCode}${cleanPhone}`, {
      ...existingData,
      otp,
      expiry: Date.now() + OTP_EXPIRY_MS,
      lastResendRequest: now
    });

    // Send OTP via WhatsApp using Interakt resend method
    const whatsappResult = await whatsappService.resendOTP(cleanPhone, otp, extractedCountryCode);
    
    if (!whatsappResult.success && !whatsappResult.fallback) {
      console.error('WhatsApp OTP resend failed:', whatsappResult.error);
      return res.status(500).json({ error: 'Failed to resend OTP via WhatsApp' });
    }

    // Log fallback usage
    if (whatsappResult.fallback) {
      console.log('Using fallback OTP delivery due to WhatsApp service failure');
    }

    res.json({ 
      success: true, 
      message: 'OTP resent successfully',
      isNewPatient: existingData.isNewPatient,
      // Only in development: return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp })
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to resend OTP', details: error.message });
  }
});

// Verify OTP endpoint
router.post('/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    
    if (!phoneNumber || !otp) {
      return res.status(400).json({ error: 'Phone number and OTP are required' });
    }

    // Normalize phone number to match the format used during OTP storage
    let normalizedPhone = phoneNumber.replace(/\s/g, '');
    
    // Extract country code from phone if present (same logic as send-otp)
    let extractedCountryCode = '91'; // Default to India
    let cleanPhone = normalizedPhone;
    
    const phoneRegex = /^([+]?[0-9]{1,3})([0-9]{10,15})$/;
    const match = normalizedPhone.match(phoneRegex);
    if (match) {
      extractedCountryCode = match[1].replace('+', '');
      cleanPhone = match[2];
    }
    
    // Use the same format as storage: countryCode + cleanPhone
    const storageKey = `${extractedCountryCode}${cleanPhone}`;

    const storedData = otpStore.get(storageKey);
    
    // Log OTP for testing purposes (helpful when Interakt fails)
    if (storedData && storedData.otp) {
      console.log(`VERIFY OTP ATTEMPT - Phone: ${phoneNumber} (normalized: ${storageKey}), Stored OTP: ${storedData.otp}, Attempted OTP: ${otp}`);
    } else {
      console.log(`VERIFY OTP ATTEMPT - Phone: ${phoneNumber} (normalized: ${storageKey}), No stored OTP found`);
    }
    
    // Check if OTP exists
    if (!storedData) {
      return res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });
    }

    // Check expiry
    if (Date.now() > storedData.expiry) {
      otpStore.delete(storageKey);
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    // Check max attempts (3)
    if (storedData.attempts >= 3) {
      otpStore.delete(storageKey);
      return res.status(400).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      storedData.attempts++;
      return res.status(400).json({ 
        error: 'Invalid OTP',
        attemptsLeft: 3 - storedData.attempts
      });
    }

    // OTP verified - clear from store and get patient status
    const { isNewPatient } = storedData;
    otpStore.delete(storageKey);

    let patient;
    let fields;
    let patientId;

    if (isNewPatient) {
      // For new patients, create a minimal response without creating Airtable record
      // The actual patient record will be created during onboarding process
      patientId = null; // No Airtable record yet
      fields = {
        'Full Name': '',
        'Email': '',
        'Phone Number': phoneNumber.replace(/\s/g, ''),
        'Skin Concern': '',
        'Plan Type': '',
        'Start Date': new Date().toISOString().split('T')[0],
        'Coach Name': '',
        'Has Committed': false
      };
    } else {
      // Get existing patient data from Diet Plan table
      const dietPlanTable = base(TABLES.DIET_PLANS);
      const records = await dietPlanTable.select({
        filterByFormula: `{Phone Number} = '${phoneNumber.replace(/\s/g, '')}'`,
        maxRecords: 1
      }).firstPage();

      if (records.length === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      patient = records[0];
      patientId = patient.id;
      fields = patient.fields;
    }

    // Get products (will be empty for new patients)
    const products = isNewPatient ? [] : await getPatientProducts(patientId);

    // Diet plan is already in the patient record for existing patients
    const dietPlan = isNewPatient ? null : {
      id: patientId,
      version: fields['Version'] || '',
      category: fields['Category'] || '',
      restrictions: fields['Restrictions'] ? fields['Restrictions'].split(',').map(r => r.trim()) : [],
      recommendations: fields['Recommendations'] ? fields['Recommendations'].split(',').map(r => r.trim()) : [],
      notes: fields['Notes'] || '',
      mealPlan: fields['Meal Plan'] || ''
    };

    const patientData = {
      id: patientId,
      name: fields['Full Name'] || '',
      email: fields['Email'] || '',
      phone: phoneNumber,
      concern: fields['Skin Concern'] || '',
      planType: fields['Plan Type'] || '',
      startDate: fields['Start Date'] || new Date().toISOString().split('T')[0],
      coachName: fields['Coach Name'] || '',
      hasCommitted: fields['Has Committed'] || false,
      products,
      dietPlan,
      isNewPatient
    };

    // Generate JWT token with 180-day expiry
    const token = jwt.sign(
      { 
        patientId: patientId,
        email: fields['Email'] || '',
        phone: phoneNumber
      },
      process.env.JWT_SECRET,
      { expiresIn: '180d' }
    );

    // Sync patient to MongoDB if not new patient
    if (!isNewPatient && patientId) {
      try {
        await fetch(`${process.env.CLIENT_URL || 'http://localhost:3000'}/api/mongodb/patient/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            airtableId: patientId,
            email: fields['Email'] || '',
            phone: phoneNumber,
            name: fields['Full Name'] || '',
            startDate: fields['Start Date'] || new Date().toISOString().split('T')[0],
            profile: {
              concern: fields['Skin Concern'] || '',
              planType: fields['Plan Type'] || '',
              coachName: fields['Coach Name'] || ''
            },
            commitment: fields['Has Committed'] ? 'basic' : 'none'
          })
        }).catch(err => console.log('MongoDB sync failed:', err.message));
      } catch (mongoError) {
        console.log('MongoDB sync failed (continuing):', mongoError.message);
      }
    }

    res.json({
      success: true,
      token,
      patient: patientData,
      hasCommitted: fields['Has Committed'] || false,
      isNewPatient
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Test Interakt WhatsApp service connection
router.get('/test-whatsapp', async (req, res) => {
  try {
    const testResult = await whatsappService.testConnection();
    res.json(testResult);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper functions
async function getPatientProducts(patientId) {
  try {
    const productsTable = base(TABLES.PRODUCTS);
    const records = await productsTable.select({
      filterByFormula: `FIND('${patientId}', ARRAYJOIN(Patient, ','))`,
    }).firstPage();

    return records.map(record => ({
      id: record.id,
      name: record.fields['Product Name'] || '',
      category: record.fields['Category'] || '',
      instructions: record.fields['Instructions'] || ''
    }));
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

async function getDietPlan(dietPlanIds) {
  if (!dietPlanIds || dietPlanIds.length === 0) {
    return null;
  }
  
  try {
    const dietTable = base(TABLES.DIET_PLANS);
    const record = await dietTable.find(dietPlanIds[0]);
    
    // Get dietician details from Team table
    let dieticianDetails = {
      dieticianName: '',
      dieticianPhone: '',
      dieticianEmail: '',
      dieticianWhatsApp: ''
    };
    
    try {
      const teamRecords = await base(TABLES.TEAM)
        .select({
          filterByFormula: `{Department} = 'Dietician'`,
          maxRecords: 1
        })
        .firstPage();
      
      if (teamRecords.length > 0) {
        const dietician = teamRecords[0].fields;
        dieticianDetails = {
          dieticianName: dietician['Name'] || '',
          dieticianPhone: dietician['Phone Number'] || '',
          dieticianEmail: dietician['Email'] || ''
        };
      }
    } catch (teamError) {
      console.error('Error fetching dietician from Team table:', teamError);
    }
    
    return {
      id: record.id,
      version: record.fields['Version'] || '',
      category: record.fields['Category'] || '',
      restrictions: record.fields['Restrictions'] ? record.fields['Restrictions'].split(',').map(r => r.trim()) : [],
      recommendations: record.fields['Recommendations'] ? record.fields['Recommendations'].split(',').map(r => r.trim()) : [],
      // Dietician details from Team table
      ...dieticianDetails,
      notes: record.fields['Notes'] || '',
      mealPlan: record.fields['Meal Plan'] || ''
    };
  } catch (error) {
    console.error('Error fetching diet plan:', error);
    return null;
  }
}

module.exports = router;
