# BiteSpeed WhatsApp Integration

This service enables OTP delivery through WhatsApp using BiteSpeed's direct HTTP endpoint (no API key required).

## Setup Instructions

### 1. Get BiteSpeed Access
- Contact BiteSpeed for direct endpoint access
- Get your WhatsApp Business number configured
- Note your WhatsApp Business phone number

### 2. Configure Environment Variables
Update your `.env` file with the following:

```env
# BiteSpeed WhatsApp Configuration (Direct Endpoint - No API Key Required)
BITESPEED_API_URL=https://wa.bitespeed.com
BITESPEED_WHATSAPP_NUMBER=your_whatsapp_business_number
# Optional: Business identifier if provided by BiteSpeed
# BITESPEED_BUSINESS_ID=your_business_id
```

### 3. Test the Integration
Start your server and test the WhatsApp connection:

```bash
# Test WhatsApp service connection
GET http://localhost:5000/api/otp/test-whatsapp
```

### 4. Send OTP
The OTP will automatically be sent via WhatsApp when users request it:

```bash
# Send OTP (this is done automatically by the frontend)
POST http://localhost:5000/api/otp/send-otp
{
  "phone": "+919876543210"
}
```

## API Details

### Direct Endpoint Usage
- **Base URL**: `https://wa.bitespeed.com`
- **Send Endpoint**: `POST /send`
- **No Authentication**: Uses direct endpoint access
- **Payload Format**:
  ```json
  {
    "number": "919876543210",
    "message": "Your OTP code is: 123456"
  }
  ```

## Features

- **Direct WhatsApp OTP delivery** using BiteSpeed HTTP endpoint
- **No API key required** - uses direct endpoint access
- **Fallback mechanism**: If WhatsApp fails, OTP is logged to console
- **Phone number formatting**: Automatically formats Indian numbers
- **Error handling**: Comprehensive error handling with logging
- **Development support**: Returns OTP in development mode for testing

## Message Format

The WhatsApp message includes:
- Professional branding with Gleuhr logo
- Clear OTP code display
- Expiry information (5 minutes)
- Security warning about not sharing the code

## Error Handling

- If BiteSpeed API fails, the system falls back to console logging
- All errors are logged for debugging
- The user experience remains uninterrupted

## Security Notes

- API keys are stored in environment variables
- OTPs have 5-minute expiry
- Maximum 3 verification attempts
- Phone numbers are validated before sending

## Troubleshooting

1. **Check API Key**: Ensure your BiteSpeed API key is valid
2. **WhatsApp Number**: Verify your WhatsApp Business number is correct
3. **Phone Format**: Ensure phone numbers include country code
4. **Network**: Check your server's internet connection
5. **Rate Limits**: Be aware of BiteSpeed's rate limiting

For support, check the server logs or contact BiteSpeed support.
