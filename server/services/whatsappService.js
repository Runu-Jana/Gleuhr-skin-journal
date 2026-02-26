const axios = require('axios');

class WhatsAppService {
  constructor() {
    // Interakt API configuration
    this.apiKey = process.env.INTERAKT_API_KEY;
    this.baseUrl = process.env.INTERAKT_API_URL || 'https://api.interakt.ai/v1/public/message/';
    this.fromNumber = process.env.INTERAKT_WHATSAPP_NUMBER;
  }

  async sendOTP(phoneNumber, otp, countryCode = '91') {
    try {
      // Remove any non-digit characters and ensure proper format
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Use provided country code (default to India if not specified)
      const formattedPhone = cleanPhone.startsWith(countryCode) ? cleanPhone : `${countryCode}${cleanPhone}`;
      
      // Interakt API payload for WhatsApp template message
      const payload = {
        phoneNumber: cleanPhone, // Send phone number without country code
        countryCode: countryCode,
        callbackData: "journal_otp_v1",
        type: "Template",
        template: {
          name: "journal_otp_v1",
          languageCode: "en",
          bodyValues: [
            otp, // OTP in body
            "10 minutes" // Expiry time
          ]
        }
      };

      console.log(`Sending WhatsApp OTP via Interakt to ${formattedPhone} (country: ${countryCode}): ${otp}`);

      const response = await axios.post(`${this.baseUrl}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.apiKey}`
        },
        timeout: 10000 // 10 second timeout
      });

      console.log('WhatsApp OTP sent successfully via Interakt:', response.data);
      return {
        success: true,
        messageId: response.data.messageId || response.data.id || 'sent',
        response: response.data
      };

    } catch (error) {
      console.error('Interakt WhatsApp OTP sending failed:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Fallback to console log in case of WhatsApp failure
      console.log(`FALLBACK - OTP for ${phoneNumber}: ${otp}`);
      
      // Return success to avoid breaking the flow, but log the error
      return {
        success: true,
        fallback: true,
        error: error.message
      };
    }
  }

  async resendOTP(phoneNumber, otp, countryCode = '91') {
    try {
      // Remove any non-digit characters and ensure proper format
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // Use provided country code (default to India if not specified)
      const formattedPhone = cleanPhone.startsWith(countryCode) ? cleanPhone : `${countryCode}${cleanPhone}`;
      
      // Interakt API payload for WhatsApp resend template message
      const payload = {
        phoneNumber: cleanPhone, // Send phone number without country code
        countryCode: countryCode,
        callbackData: "otp_resend_code",
        type: "Template",
        template: {
          name: "otp_resend_code",
          languageCode: "en",
          bodyValues: [
            otp, // OTP in body
            "10 minutes" // Expiry time
          ]
        }
      };

      console.log(`Resending WhatsApp OTP via Interakt to ${formattedPhone} (country: ${countryCode}): ${otp}`);

      const response = await axios.post(`${this.baseUrl}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.apiKey}`
        },
        timeout: 10000 // 10 second timeout
      });

      console.log('WhatsApp OTP resent successfully via Interakt:', response.data);
      return {
        success: true,
        messageId: response.data.messageId || response.data.id || 'resent',
        response: response.data,
        resent: true
      };

    } catch (error) {
      console.error('Interakt WhatsApp OTP resend failed:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Fallback to console log in case of WhatsApp failure
      console.log(`FALLBACK - RESEND OTP for ${phoneNumber}: ${otp}`);
      
      // Return success to avoid breaking the flow, but log the error
      return {
        success: true,
        fallback: true,
        error: error.message,
        resent: true
      };
    }
  }

  async generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async storeVerificationCode(phoneNumber, code) {
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // In production, store in Redis or database
    // For now, store in memory (not recommended for production)
    if (!global.verificationCodes) {
      global.verificationCodes = new Map();
    }
    
    global.verificationCodes.set(phoneNumber, {
      code,
      expiry: expiryTime,
      attempts: 0
    });
  }

  async verifyCode(phoneNumber, inputCode) {
    if (!global.verificationCodes) {
      return { valid: false, error: 'No verification code found' };
    }
    
    const stored = global.verificationCodes.get(phoneNumber);
    
    if (!stored) {
      return { valid: false, error: 'Verification code expired' };
    }
    
    if (stored.attempts >= 3) {
      global.verificationCodes.delete(phoneNumber);
      return { valid: false, error: 'Too many attempts. Please request a new code.' };
    }
    
    if (new Date() > stored.expiry) {
      global.verificationCodes.delete(phoneNumber);
      return { valid: false, error: 'Verification code expired' };
    }
    
    stored.attempts++;
    
    if (stored.code === inputCode) {
      global.verificationCodes.delete(phoneNumber);
      return { valid: true };
    } else {
      return { valid: false, error: 'Invalid verification code', attemptsLeft: 3 - stored.attempts };
    }
  }

  async testConnection() {
    try {
      // Test Interakt API connection by making a simple POST request
      const response = await axios.post(`${this.baseUrl}`, {}, {
        headers: {
          'Authorization': `Basic ${this.apiKey}`
        },
        timeout: 5000
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WhatsAppService();
