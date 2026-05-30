# SendGrid Email Notifications Setup

## Overview

This document describes the SendGrid email notification system for the P2P Kids Marketplace.

## Current Status

✅ **COMPLETE** - TASK INFRA-010 implemented

## Components

### 1. Mobile App Email Service
**Location:** `p2p-kids-marketplace/src/services/email.ts`

Core service for sending emails from the mobile app.

**Functions:**
- `sendEmail()` - Send generic HTML emails
- `sendWelcomeEmail()` - Send welcome email to new users
- `sendPasswordResetEmail()` - Send password reset link
- `sendTradeNotificationEmail()` - Notify seller of trade request
- `sendTransactionConfirmationEmail()` - Confirm purchase to buyer
- `sendSubscriptionStatusEmail()` - Notify subscription changes
- `sendBatchEmails()` - Send multiple emails with retry logic

**Usage Example:**
```typescript
import { sendWelcomeEmail } from '@/services/email';

const result = await sendWelcomeEmail({
  firstName: 'John',
  email: 'john@example.com',
});
```

### 2. Email Types
**Location:** `p2p-kids-marketplace/src/types/email.ts`

TypeScript interfaces for all email data types.

### 3. Email Constants
**Location:** `p2p-kids-marketplace/src/constants/email.ts`

SendGrid configuration, template IDs, and retry settings.

### 4. Supabase Edge Function
**Location:** `supabase/functions/send-email/index.ts`

Server-side email sending via Supabase Edge Functions (Deno/TypeScript).

**Endpoint:** `POST /functions/v1/send-email`

**Request Format:**
```json
{
  "type": "welcome",
  "to": "user@example.com",
  "data": {
    "firstName": "John",
    "appDownloadLink": "https://..."
  }
}
```

### 5. Testing Utilities
**Location:** `p2p-kids-marketplace/src/utils/testEmail.ts`

Helper functions to test email sending in development.

**Functions:**
- `testWelcomeEmail()` - Test welcome email
- `testPasswordResetEmail()` - Test password reset
- `testTradeNotificationEmail()` - Test trade notification
- `testTransactionConfirmationEmail()` - Test transaction confirmation
- `testSubscriptionStatusEmail()` - Test subscription status
- `runAllEmailTests()` - Run all email tests

### 6. Unit Tests
**Location:** `p2p-kids-marketplace/src/services/__tests__/email.test.ts`

Comprehensive Jest unit tests for all email functions.

## Configuration

### Environment Variables

Add these to `.env.local`:

```bash
# SendGrid API Key (required)
EXPO_PUBLIC_SENDGRID_API_KEY=SG.your-api-key-here

# SendGrid Template IDs (update with actual IDs from SendGrid dashboard)
SENDGRID_TEMPLATE_WELCOME=d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_TEMPLATE_PASSWORD_RESET=d-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
SENDGRID_TEMPLATE_TRADE_NOTIFICATION=d-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz
SENDGRID_TEMPLATE_TRANSACTION_CONFIRMATION=d-wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
SENDGRID_TEMPLATE_SUBSCRIPTION_STATUS=d-vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
```

## Getting Started with SendGrid

### 1. Create SendGrid Account
- Go to https://sendgrid.com
- Click "Start for Free"
- Select Free tier (100 emails/day)

### 2. Verify Sender Email
1. Go to **Settings → Sender Authentication**
2. Click "Get Started" under "Verify a Single Sender"
3. Fill in:
   - From Name: `P2P Kids Marketplace`
   - From Email: `noreply@p2pkidsmarketplace.com`
   - Reply To: `support@p2pkidsmarketplace.com`
4. Verify email address from link sent

### 3. Create API Key
1. Go to **Settings → API Keys**
2. Click "Create API Key"
3. Name: `P2P Marketplace Production`
4. Permissions: `Full Access`
5. Copy key and add to `.env.local`

### 4. Create Email Templates
1. Go to **Email API → Dynamic Templates**
2. Click "Create a Dynamic Template"
3. Create 5 templates with these names:
   - `welcome-email` → Save template ID
   - `password-reset` → Save template ID
   - `trade-notification` → Save template ID
   - `transaction-confirmation` → Save template ID
   - `subscription-status` → Save template ID

### 5. (Optional) Configure Domain Authentication
For better deliverability, configure DNS:
1. Go to **Settings → Sender Authentication**
2. Click "Authenticate Your Domain"
3. Follow DNS setup instructions for Cloudflare
4. Wait for verification (5-60 minutes)

## Testing

### Run Unit Tests
```bash
npm test src/services/__tests__/email.test.ts
```

### Test Email Sending Manually
```bash
npm test -- --testNamePattern="Email" --watch
```

### Test in Development App
1. Import the test utility:
```typescript
import { testWelcomeEmail } from '@/utils/testEmail';

// Call in a button press or on app startup
await testWelcomeEmail('your-test-email@example.com');
```

2. Check SendGrid dashboard:
   - Go to **Activity → Email Activity**
   - Verify email was sent

## Email Templates

Each template should include the following handlebars variables:

### Welcome Email
- `{{firstName}}` - User's first name
- `{{appDownloadLink}}` - Link to app download

### Password Reset
- `{{resetLink}}` - Password reset link
- `{{expiryMinutes}}` - Minutes until reset link expires

### Trade Notification
- `{{buyerName}}` - Name of buyer
- `{{itemTitle}}` - Title of item
- `{{itemPrice}}` - Item price
- `{{tradeLink}}` - Link to trade view

### Transaction Confirmation
- `{{sellerName}}` - Name of seller
- `{{itemTitle}}` - Title of item
- `{{transactionId}}` - Transaction ID
- `{{itemPrice}}` - Item price
- `{{swapPointsUsed}}` - Swap points used in transaction

### Subscription Status
- `{{status}}` - Status (activated/cancelled/expired)
- `{{tier}}` - Subscription tier
- `{{expiryDate}}` - When subscription expires

## Free Tier Limits

- **100 emails/day** on free tier
- **50 emails/day** in development
- **$19.95/month** for 50,000 emails/month (paid tier)

## Monitoring

### Email Activity
1. Go to SendGrid Dashboard
2. **Activity → Email Activity**
3. View sent, opened, clicked, bounced, dropped emails

### Email Statistics
1. Go to **Stats**
2. Monitor:
   - Emails sent
   - Open rate
   - Click rate
   - Bounce rate
   - Spam reports

## Troubleshooting

### "SendGrid API key not configured"
- Check `.env.local` has `EXPO_PUBLIC_SENDGRID_API_KEY`
- Verify key is valid from SendGrid dashboard
- Restart app after adding key

### "Failed to send email"
- Check SendGrid API key is correct
- Verify template IDs are correct in `.env.local`
- Check email address is valid
- Monitor SendGrid Activity → Email Activity for errors

### "Template not found"
- Go to SendGrid dashboard
- Copy exact template ID from Dynamic Templates
- Update `.env.local` with correct ID

### Emails not received
- Check spam/junk folder
- Verify sender email is authenticated in SendGrid
- Enable domain authentication for better deliverability
- Check SendGrid Activity for bounce/drop reasons

## Integration Points

### Auth Service
When user signs up:
```typescript
// Send welcome email
await sendWelcomeEmail({
  firstName: user.first_name,
  email: user.email,
});
```

### Trade Flow
When seller receives trade request:
```typescript
// Send trade notification
await sendTradeNotificationEmail({
  sellerEmail: seller.email,
  buyerName: buyer.name,
  itemTitle: listing.title,
  itemPrice: listing.price,
});
```

### Subscription Service
When subscription changes:
```typescript
// Send subscription status email
await sendSubscriptionStatusEmail({
  email: user.email,
  status: 'activated',
  tier: 'Kids Club+',
  expiryDate: expiryDate.toISOString(),
});
```

## Files Created/Modified

### Created:
- ✅ `p2p-kids-marketplace/src/services/email.ts` - Email service
- ✅ `p2p-kids-marketplace/src/types/email.ts` - Email types
- ✅ `p2p-kids-marketplace/src/constants/email.ts` - Email constants
- ✅ `p2p-kids-marketplace/src/utils/testEmail.ts` - Test utilities
- ✅ `p2p-kids-marketplace/src/services/__tests__/email.test.ts` - Unit tests
- ✅ `supabase/functions/send-email/index.ts` - Edge Function

### Modified:
- ✅ `p2p-kids-marketplace/.env.local.example` - Added SendGrid vars
- ✅ `p2p-kids-marketplace/package.json` - Added @sendgrid/mail dependency

## Next Steps

1. **Create SendGrid account & templates** (manual steps above)
2. **Update `.env.local`** with API key and template IDs
3. **Test email sending** with `npm test` or test utilities
4. **Integrate into auth, trade, and subscription services**
5. **Set up email monitoring** in SendGrid dashboard
6. **Create HTML email templates** in SendGrid with your branding

## References

- [SendGrid API Documentation](https://sendgrid.com/docs/api-reference/)
- [Dynamic Templates Guide](https://sendgrid.com/docs/ui/sending-email/how-to-send-an-email-with-dynamic-templates/)
- [Module INFRA-010](../Prompts/MODULE-01-INFRASTRUCTURE.md)
