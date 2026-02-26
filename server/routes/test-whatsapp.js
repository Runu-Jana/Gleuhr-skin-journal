const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');

// Test WhatsApp connection
router.get('/test-connection', async (req, res) => {
  try {
    const result = await whatsappService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test sending WhatsApp message
router.post('/test-send', async (req, res) => {
  try {
    const { phoneNumber, countryCode = '91' } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const code = whatsappService.generateVerificationCode();
    const result = await whatsappService.sendOTP(phoneNumber, code, countryCode);
    
    res.json({
      success: true,
      code,
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
