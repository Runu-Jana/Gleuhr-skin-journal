# Airtable Setup Guide for Admin Dashboard

## Problem
Admin dashboard is not showing patient details from Airtable because Airtable credentials are not configured.

## Solution Steps

### 1. Get Airtable Personal Access Token
1. Go to [Airtable Account Settings](https://airtable.com/create/tokens)
2. Click "Create new token"
3. Give it a name like "Gleuhr Admin Dashboard"
4. Select scopes: `data.records:read`, `data.records:write`
5. Copy the Personal Access Token

### 2. Get Airtable Base ID
1. Open your Airtable workspace
2. Go to the "Diet Plan" table
3. Click "Help" > "API documentation"
4. Copy the Base ID (looks like `appXXXXXXXXXXXXXX`)

### 3. Update .env file
Replace the placeholder values in `.env` file:

```env
# Replace these with your actual Airtable credentials
AIRTABLE_PAT=patYOUR_PERSONAL_ACCESS_TOKEN_HERE
AIRTABLE_BASE_ID=appYOUR_BASE_ID_HERE
AIRTABLE_DIET_PLAN_TABLE=Diet Plan
```

### 4. Restart Server
```bash
cd server
npm start
```

## Expected Airtable Table Structure
The "Diet Plan" table should have these columns:
- Customer Name (Single line text)
- Customer Phone (Phone number)
- Plan Category (Single select: Vegan, Vegetarian, Keto, etc.)
- Restrictions (Multi-select or text)
- Recommendations (Long text)
- Dietician Name (Single line text)
- Dietician Phone (Phone number)
- Status (Single select: Active/Inactive)
- Start Date (Date)
- Notes (Long text)

## Verification
After configuration, you should see:
1. Server logs: "Airtable connected successfully" (no more warnings)
2. Admin dashboard shows patient diet plan details
3. Dietician information appears in patient details
4. Plan due dates and restrictions are visible

## Troubleshooting
- **"Airtable credentials not configured"**: Check .env file has correct AIRTABLE_PAT and AIRTABLE_BASE_ID
- **No diet plan data**: Verify table name matches AIRTABLE_DIET_PLAN_TABLE
- **Permission errors**: Ensure token has correct scopes
- **Base not found**: Double-check BASE_ID format (should start with "app")
