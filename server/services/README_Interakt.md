# Interakt WhatsApp Integration

This service enables OTP delivery through WhatsApp using Interakt's API platform.

## Setup Instructions

### 1. Get Interakt Credentials
- Sign up at [Interakt](https://interakt.ai)
- Get your API key from the dashboard
- Set up your WhatsApp Business number
- Create an OTP template named "gleuhr_otp"

### 2. Configure WhatsApp Templates
Create two WhatsApp templates in Interakt:

#### Template 1: Initial OTP (`otp_verification_code`)
- **Template Name**: `otp_verification_code`
- **Category**: Authentication
- **Language**: English
- **Body**: Contains OTP ({{1}}) and expiry time ({{2}}) variables

Example template content:
```
Body: Hi! Your Gleuhr verification code is {{1}}. This code expires in {{2}}. Please do not share this code with anyone.

Footer: - Team Gleuhr
```

#### Template 2: Resend OTP (`otp_resend_code`)
- **Template Name**: `otp_resend_code`
- **Category**: Authentication
- **Language**: English
- **Body**: Contains OTP ({{1}}) and expiry time ({{2}}) variables

Example template content:
```
Body: Here's your new Gleuhr verification code: {{1}}. This code expires in {{2}}. Please do not share this code with anyone.

Footer: - Team Gleuhr
```

### 3. Configure Environment Variables
Update your `.env` file with the following:

```env
# Interakt WhatsApp Configuration
INTERAKT_API_KEY=your_actual_interakt_api_key
INTERAKT_API_URL=https://api.interakt.ai/v1
INTERAKT_WHATSAPP_NUMBER=your_whatsapp_business_number
```

### 4. Test the Integration
Start your server and test the WhatsApp connection:

```bash
# Test WhatsApp service connection
GET http://localhost:5000/api/otp/test-whatsapp
```

### 5. Send OTP
The OTP will automatically be sent via WhatsApp when users request it:

```bash
# Send initial OTP (this is done automatically by the frontend)
POST http://localhost:5000/api/otp/send-otp
{
  "phone": "+919876543210",
  "countryCode": "91"
}

# Resend OTP (when user clicks resend button)
POST http://localhost:5000/api/otp/resend-otp
{
  "phone": "+919876543210", 
  "countryCode": "91"
}
```

## API Details

### Interakt API Usage
- **Base URL**: `https://api.interakt.ai/v1`
- **Send Endpoint**: `POST /message/send`
- **Authentication**: Basic Auth (API Key as username, empty password)
- **Payload Format**:
  ```json
  {
    "phoneNumber": "919876543210",
    "countryCode": "91",
    "callbackData": "otp_verification",
    "type": "Template",
    "template": {
      "name": "gleuhr_otp",
      "languageCode": "en",
      "headerValues": ["123456"],
      "bodyValues": ["123456", "5 minutes"]
    }
  }
  ```

## Features

- **Template-based WhatsApp OTP delivery** using Interakt API
- **Separate templates** for initial OTP and resend OTP
- **30-second cooldown** between resend requests to prevent spam
- **Professional WhatsApp templates** approved by WhatsApp
- **Fallback mechanism**: If WhatsApp fails, OTP is logged to console
- **Phone number formatting**: Automatically formats Indian numbers
- **Error handling**: Comprehensive error handling with logging
- **Development support**: Returns OTP in development mode for testing

## Message Format

The WhatsApp message is sent using a pre-approved template:
- Professional branding with Gleuhr
- Clear OTP code display in header and body
- Expiry information (5 minutes)
- Security warning about not sharing the code

## Error Handling

- If Interakt API fails, the system falls back to console logging
- All errors are logged for debugging
- The user experience remains uninterrupted

## Security Notes

- API keys are stored in environment variables
- OTPs have 5-minute expiry
- Maximum 3 verification attempts
- Phone numbers are validated before sending
- Uses Basic Authentication for API security

## Troubleshooting

1. **Check API Key**: Ensure your Interakt API key is valid
2. **Template Approval**: Verify your "gleuhr_otp" template is approved
3. **WhatsApp Number**: Verify your WhatsApp Business number is correct
4. **Phone Format**: Ensure phone numbers include country code
5. **Network**: Check your server's internet connection
6. **Rate Limits**: Be aware of Interakt's rate limiting

For support, check the server logs or contact Interakt support.
