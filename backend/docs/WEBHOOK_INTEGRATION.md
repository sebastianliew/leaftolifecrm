# Fluent Forms Pro Webhook Integration

This document explains how to integrate your WordPress site using Fluent Forms Pro with the LeafToLife patient management system.

## Overview

The webhook integration allows you to automatically create or update patient records when users submit intake forms on your WordPress website using Fluent Forms Pro.

## Webhook Endpoints

### Base URL
```
https://your-ngrok-url.ngrok-free.app/api/webhooks
```

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check for webhook service |
| `/test` | POST | Test endpoint for debugging |
| `/fluent-forms/intake` | POST | Main intake form webhook |

## Setup Instructions

### 1. Configure Fluent Forms Pro

1. Go to your WordPress admin dashboard
2. Navigate to **Fluent Forms > Settings > Integrations**
3. Enable the **Webhooks** integration
4. Add a new webhook with these settings:
   - **URL**: `https://your-ngrok-url.ngrok-free.app/api/webhooks/fluent-forms/intake`
   - **Method**: `POST`
   - **Format**: `JSON`
   - **Send**: `All Fields`

### 2. Required Form Fields

Your intake form must include these required fields (field names can vary):

| Required Field | Possible Field Names | Example Value |
|----------------|---------------------|---------------|
| First Name | `first_name`, `firstName`, `fname` | "John" |
| Last Name | `last_name`, `lastName`, `lname` | "Doe" |
| Email | `email`, `email_address`, `e_mail` | "john@email.com" |
| Phone | `phone`, `phone_number`, `mobile` | "+1-555-0123" |
| Date of Birth | `date_of_birth`, `dob`, `birthdate` | "1990-05-15" |
| Gender | `gender`, `sex` | "male", "female", "other" |

### 3. Optional Fields

The system also supports these optional fields:

| Optional Field | Possible Field Names | Example Value |
|----------------|---------------------|---------------|
| Middle Name | `middle_name`, `middleName`, `mname` | "Michael" |
| NRIC/IC | `nric`, `ic`, `national_id` | "S1234567A" |
| Blood Type | `blood_type`, `bloodType` | "O+", "A-", etc. |
| Marital Status | `marital_status`, `maritalStatus` | "single", "married" |
| Occupation | `occupation`, `job`, `profession` | "Engineer" |
| Alt Phone | `alt_phone`, `altPhone`, `phone_2` | "+1-555-0124" |
| Address | `address`, `street_address` | "123 Main St" |
| City | `city`, `town` | "Singapore" |
| State | `state`, `province` | "Singapore" |
| Postal Code | `postal_code`, `zip_code`, `postcode` | "123456" |

## Security Configuration

### Environment Variables

Add these to your backend `.env.local` file:

```env
# Optional: Fluent Forms webhook secret key for signature validation
FLUENT_FORMS_SECRET_KEY=your-secret-key-here

# Optional: Allowed IP addresses (comma-separated)
WEBHOOK_ALLOWED_IPS=192.168.1.1,10.0.0.1
```

### Security Features

1. **Rate Limiting**: 50 requests per 15 minutes per IP
2. **Signature Validation**: HMAC-SHA256 signatures (if secret key configured)
3. **Timestamp Validation**: Prevents replay attacks
4. **IP Whitelisting**: Restrict access to specific IPs
5. **User-Agent Validation**: Blocks suspicious bots
6. **Content Validation**: Validates JSON payload structure

## Testing the Integration

### 1. Health Check
```bash
curl https://your-ngrok-url.ngrok-free.app/api/webhooks/health
```

### 2. Test Endpoint
```bash
curl -X POST https://your-ngrok-url.ngrok-free.app/api/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### 3. Run Automated Tests
```bash
cd backend
npm run test:webhook
```

Or run the test script directly:
```bash
cd backend
npx ts-node scripts/test-webhook.ts
```

## Sample Webhook Payload

Here's an example of what Fluent Forms Pro sends:

```json
{
  "form_id": "123",
  "serial_number": "FL_1640995200",
  "source_url": "https://yoursite.com/intake-form/",
  "created_at": "2024-01-01T12:00:00Z",
  "response": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@email.com",
    "phone": "+1-555-0123",
    "date_of_birth": "1990-05-15",
    "gender": "male",
    "occupation": "Software Engineer",
    "address": "123 Main Street",
    "city": "Singapore",
    "state": "Singapore",
    "postal_code": "123456"
  }
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Intake form processed successfully",
  "patientId": "60f7c1234567890abcdef123",
  "action": "created",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Failed to process intake form",
  "message": "Missing required field: email",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Troubleshooting

### Common Issues

1. **"Missing required fields"**
   - Check that your form includes all required fields
   - Verify field names match expected patterns
   - Ensure fields are not empty

2. **"Webhook signature validation failed"**
   - Check that the secret key matches in both systems
   - Ensure Fluent Forms is sending the signature header

3. **"IP address not authorized"**
   - Add your WordPress server IP to the allowed IPs list
   - Check the `WEBHOOK_ALLOWED_IPS` environment variable

4. **"Rate limit exceeded"**
   - Wait 15 minutes for the rate limit to reset
   - Check for duplicate/spam submissions

### Debugging

1. Check the backend logs for detailed error messages
2. Use the test endpoint to verify connectivity
3. Verify your ngrok tunnel is active and accessible
4. Test with the provided test script

### Log Files

Webhook requests and responses are logged in:
- Console output (development)
- Application logs (production)

Look for these log patterns:
- `📥 Webhook Request` - Incoming requests
- `📤 Webhook Response` - Outgoing responses  
- `✅ Webhook processed successfully` - Successful processing
- `❌ Webhook processing error` - Processing errors
- `🚨 Webhook request from unauthorized IP` - Security issues

## Support

For issues with the webhook integration:

1. Check the troubleshooting section above
2. Review the application logs
3. Test with the provided test script
4. Contact the development team with specific error messages

## Configuration Examples

### Fluent Forms Pro Webhook Configuration

In your WordPress admin:

1. **Webhook URL**: `https://abc123.ngrok-free.app/api/webhooks/fluent-forms/intake`
2. **Request Method**: `POST`
3. **Request Format**: `JSON`
4. **Request Body**: Select "All Fields"
5. **Headers** (optional):
   ```
   User-Agent: FluentForms/1.8.5 WordPress/6.0
   X-Timestamp: {timestamp}
   ```

### Environment Configuration

```env
# Backend .env.local
FLUENT_FORMS_SECRET_KEY=your-32-character-secret-key
WEBHOOK_ALLOWED_IPS=203.0.113.0/24,198.51.100.1
BACKEND_PORT=5000
NODE_ENV=development
```

This completes the Fluent Forms Pro webhook integration setup!