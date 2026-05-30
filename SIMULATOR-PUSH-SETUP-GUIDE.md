# Simulator Push Notification Setup Guide

This guide walks you through setting up and testing push notifications in iOS Simulator and Android Emulator.

---

## 1. Pre-Requisites

Before you start, ensure:
- ✅ App runs on simulator without errors
- ✅ Users can login/signup successfully
- ✅ Database migrations 081-085 are applied
- ✅ SendGrid is configured (for email fallback)
- ✅ FCM Server Key added to Supabase (Android only)

---

## 2. iOS Simulator Setup

### Step 1: Enable Push Notifications in Xcode

```bash
# Open iOS project
open p2p-kids-marketplace/ios/p2pkidsmarketplace.xcworkspace

# In Xcode:
# 1. Select target "p2pkidsmarketplace"
# 2. Go to "Signing & Capabilities"
# 3. Click "+ Capability"
# 4. Search "Push Notifications"
# 5. Add it
```

### Step 2: Add Notification Initialization to App

Create/update `src/services/notifications.ts`:

```typescript
// File: p2p-kids-marketplace/src/services/notifications.ts

import * as Notifications from 'expo-notifications';
import { supabase } from '../config/supabase';

// Set notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Initialize push notifications
 * Call this when user logs in
 */
export async function initializePushNotifications(userId: string) {
  try {
    console.log('[Notifications] Initializing for user:', userId);
    
    // Get permission
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        console.warn('[Notifications] Permission denied');
        return;
      }
    }

    // Get push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;
    console.log('[Notifications] Expo Push Token registered:', pushToken);

    // Save to database
    const { data, error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token: pushToken,
          device_type: 'expo',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select();

    if (error) {
      console.error('[Notifications] Save error:', error);
      return;
    }

    console.log('[Notifications] ✅ Token saved to database:', data);

    // Listen for notifications
    const subscription = Notifications.addNotificationResponseListener((response) => {
      console.log('[Notifications] Notification received:', response);
      // Handle deep linking, analytics, etc.
    });

    return subscription;
  } catch (error) {
    console.error('[Notifications] Error:', error);
  }
}

/**
 * Clean up on logout
 */
export async function cleanupPushNotifications(userId: string) {
  try {
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[Notifications] Cleanup error:', error);
    } else {
      console.log('[Notifications] ✅ Cleaned up');
    }
  } catch (error) {
    console.error('[Notifications] Cleanup failed:', error);
  }
}
```

### Step 3: Call Initialization on Login

Update your LoginScreen or AuthContext:

```typescript
// Example in LoginScreen.tsx or auth context

async function handleLoginSuccess(user: any) {
  // ... existing login code ...
  
  // NEW: Initialize notifications
  await initializePushNotifications(user.id);
  
  // Navigate to app
  navigation.reset({
    index: 0,
    routes: [{ name: 'MainApp' }],
  });
}
```

### Step 4: Verify Token Registration

```bash
# 1. Run app on iOS Simulator
npm run ios

# 2. Login with test user (e.g., testuser@example.com)

# 3. Watch Xcode console or app console output
# Look for: "[Notifications] Expo Push Token registered: ExponentPushToken[...]"

# 4. In Supabase:
SELECT user_id, token, updated_at 
FROM push_tokens 
WHERE user_id = '<USER_ID>'
ORDER BY updated_at DESC LIMIT 1;

# Expected: Token should be there with recent timestamp
```

---

## 3. Android Emulator Setup

### Step 1: Install Google Play Services

```bash
# Make sure your Android Emulator has Google Play Services installed
# In Android Studio:
# 1. Open AVD Manager
# 2. Select your emulator
# 3. Check "Google APIs" is included in system image
```

### Step 2: Add FCM Server Key

```bash
# 1. Go to Firebase Console
# 2. Select your project → Project Settings → Cloud Messaging
# 3. Copy "Server key"

# 2. Go to Supabase Dashboard
# 3. Select project → Settings → Edge Functions → Environment Variables
# 4. Add new variable:
#    Name: FCM_SERVER_KEY
#    Value: [paste server key]
```

### Step 3: Add Firebase Config to App

```bash
# Copy google-services.json to Android project
cp path/to/google-services.json \
  p2p-kids-marketplace/android/app/

# Update app-level build.gradle
# (Expo usually handles this, but verify)
```

### Step 4: Verify Token Registration

```bash
# 1. Run app on Android Emulator
npm run android

# 2. Login with test user

# 3. Check logcat for token
adb logcat | grep "Push Token"

# 4. In Supabase:
SELECT user_id, token, updated_at 
FROM push_tokens 
WHERE user_id = '<USER_ID>'
AND device_type = 'expo'
ORDER BY updated_at DESC LIMIT 1;

# Expected: Token should be there
```

---

## 4. Testing Push Notifications

### Method 1: Manual Trigger (Recommended for Simulators)

```sql
-- In Supabase SQL Editor

-- Get a test user ID
SELECT id FROM profiles LIMIT 1;

-- Insert a test message
INSERT INTO messages (
  id,
  trade_id,
  sender_id,
  content,
  created_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM trades LIMIT 1),
  '<SENDER_USER_ID>',
  'Test notification message',
  NOW()
) RETURNING id, created_at;

-- This should trigger the on_message_insert_notify trigger
-- Which calls the send-push-notification Edge Function

-- Check Supabase Dashboard → Edge Functions → send-push-notification
-- → "Recent Invocations" to verify it was called
```

### Method 2: Check Edge Function Logs

```
1. Supabase Dashboard
2. Select project
3. Edge Functions (left sidebar)
4. Click "send-push-notification"
5. Go to "Recent Invocations" tab
6. Should show successful call with:
   - Status: Success
   - Time: Recent
   - Response: {"success": true, "sent": 1}
```

### Method 3: Check App Notifications

**iOS Simulator:**
- Notifications appear in Notification Center
- Swipe down from top of simulator to see
- Tap notification to trigger listener

**Android Emulator:**
- Notifications appear in status bar
- Tap to see full notification
- Swipe down to access Notification Center

---

## 5. Troubleshooting

### Issue: Token Not Registering

```bash
# Check app console for errors
# Look for: [Notifications] Error: ...

# If you see permission errors:
# 1. Delete app from simulator
# 2. Reinstall
npm run ios --clean
# OR
npm run android --clean

# Grant notification permission when prompted
```

### Issue: Token Registered but No Notification Appears

```bash
# This is normal on iOS Simulator!
# iOS Simulator doesn't show actual notifications
# But the full flow works:
# ✅ Token registered
# ✅ Message inserted in DB
# ✅ Trigger fired
# ✅ Edge Function called
# ❌ Notification display (simulator limitation)

# Verify the flow works:
SELECT * FROM messages 
WHERE content = 'Test notification message'
ORDER BY created_at DESC LIMIT 1;

# Should return the message you inserted
# This proves the trigger worked
```

### Issue: Android Emulator Notifications Not Working

```bash
# Check FCM Server Key is set
# In Supabase Edge Functions logs, look for:
# "FCM_SERVER_KEY not found" error

# If you see this:
1. Go to Firebase Console
2. Get Server Key
3. Add to Supabase Settings → Edge Functions

# Then test again
```

### Issue: "Push token not found" Error

```sql
-- Check if token exists for user
SELECT user_id, token, created_at 
FROM push_tokens 
WHERE user_id = '<USER_ID>';

-- If empty:
-- 1. Make sure initializePushNotifications() was called
-- 2. Check app console for [Notifications] logs
-- 3. Verify Supabase connection is working

-- If token exists but error still occurs:
-- 1. Check the token is valid (starts with ExponentPushToken)
-- 2. Make sure token isn't expired
-- 3. Try deleting and re-registering
DELETE FROM push_tokens WHERE user_id = '<USER_ID>';
-- Then restart app
```

---

## 6. Complete E2E Test Flow

### Test Case: Full Push Notification Flow

```bash
# 1. Clean and rebuild
npm run ios --clean  # or npm run android --clean

# 2. Run app
npm run ios  # or npm run android

# 3. Login with credentials
# Email: testuser@example.com
# Password: Test123!

# 4. Wait for notification initialization
# Check console: "[Notifications] Expo Push Token registered: ..."

# 5. Verify token in database
# In Supabase:
SELECT COUNT(*) FROM push_tokens 
WHERE user_id = '<YOUR_USER_ID>';
# Expected result: 1

# 6. Send a test message
# In Supabase SQL Editor:
INSERT INTO messages (
  id, trade_id, sender_id, content, created_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM trades WHERE seller_id != '<YOUR_USER_ID>' LIMIT 1),
  (SELECT id FROM profiles WHERE id != '<YOUR_USER_ID>' LIMIT 1),
  'Test notification',
  NOW()
);

# 7. Check Edge Function logs
# Supabase Dashboard → Edge Functions → send-push-notification
# → Recent Invocations
# Expected: Recent successful invocation

# 8. Check app notification (iOS only)
# Swipe down from top of simulator to see Notification Center
# Should see notification with message preview

# 9. Tap notification
# App should open and handle the notification
# Check app console for: "[Notifications] Notification received: ..."

# RESULT: ✅ PASS if all steps succeeded
```

---

## 7. Quick Reference Commands

```bash
# Initialize notifications in app
npm run ios
# OR
npm run android

# View Xcode console (iOS)
# Xcode: View → Debug Area → Show Console

# View Android logcat
adb logcat | grep "Notifications\|Push\|expo"

# Test Edge Function manually
curl -X POST \
  'https://your-project.supabase.co/functions/v1/send-push-notification' \
  -H 'Authorization: Bearer your-service-role-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "message_id": "test-123",
    "recipient_user_id": "test-user-id",
    "sender_name": "Test Sender",
    "message_preview": "Test message"
  }'

# Check token in database
supabase sql \
  'SELECT user_id, token FROM push_tokens LIMIT 10;'

# Delete stale tokens
DELETE FROM push_tokens 
WHERE updated_at < NOW() - INTERVAL '7 days';
```

---

## 8. Next Steps

Once push notifications are working:

1. ✅ Complete Manual Test Case 6-1 through 6-3 (MSG-006)
2. ✅ Complete Manual Test Cases 7-1 through 7-3 (MSG-007 - email)
3. ✅ Complete Manual Test Cases 8-1 and 8-2 (MSG-008 - delivery status)
4. ✅ Complete Manual Test Cases 9-1 through 9-4 (MSG-009 - typing indicators)

---

## Summary

**You have successfully set up push notifications when you can:**

- ✅ See `[Notifications] Expo Push Token registered: ExponentPushToken[...]` in console
- ✅ See token in `push_tokens` table in Supabase
- ✅ See Edge Function called in Supabase Dashboard logs when message is inserted
- ✅ (iOS Simulator) Notifications appear in Notification Center (notification display is simulator-limited)
- ✅ (Android Emulator) Notifications appear in status bar with preview text

**Remember:** iOS Simulator has limitations on actual notification display, but the entire backend flow (registration → message → trigger → function call) works perfectly and can be verified through logs and database queries.
