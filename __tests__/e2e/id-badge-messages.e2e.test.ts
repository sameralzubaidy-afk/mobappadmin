// File: p2p-kids-admin/__tests__/e2e/id-badge-messages.e2e.test.ts

import { describe, it, expect, beforeAll } from '@jest/globals';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

describe('ID Badge Messages E2E Tests', () => {
  let testMessageId: string;

  beforeAll(async () => {
    // Skip E2E tests if no real environment available
    if (!process.env.RUN_ADMIN_E2E) {
      console.log('⏭️  Skipping E2E tests (RUN_ADMIN_E2E not set)');
      return;
    }

    // Fetch messages to get a test ID
    const response = await fetch(`${BASE_URL}/api/admin/id-badges/messages`);
    const data = await response.json();
    
    if (data.messages && data.messages.length > 0) {
      testMessageId = data.messages[0].id;
    }
  });

  // Skip all tests if E2E flag not set
  const testOrSkip = process.env.RUN_ADMIN_E2E ? it : it.skip;

  describe('GET /api/admin/id-badges/messages', () => {
    testOrSkip('should return 200 with messages array', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/id-badges/messages`);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('messages');
      expect(Array.isArray(data.messages)).toBe(true);
    });

    testOrSkip('should return all 12 messages', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/id-badges/messages`);
      const data = await response.json();
      
      expect(data.messages.length).toBeGreaterThanOrEqual(12);
    });

    testOrSkip('should include all required fields in messages', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/id-badges/messages`);
      const data = await response.json();
      
      const message = data.messages[0];
      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('message_key');
      expect(message).toHaveProperty('message_text');
      expect(message).toHaveProperty('description');
      expect(message).toHaveProperty('supports_variables');
    });

    testOrSkip('should return messages in alphabetical order by message_key', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/id-badges/messages`);
      const data = await response.json();
      
      const keys = data.messages.map((m: any) => m.message_key);
      const sortedKeys = [...keys].sort();
      expect(keys).toEqual(sortedKeys);
    });
  });

  describe('PUT /api/admin/id-badges/messages/:messageId', () => {
    testOrSkip('should update message text successfully', async () => {
      if (!testMessageId) {
        console.warn('No test message ID available, skipping test');
        return;
      }

      const updatedText = 'E2E Test Update at ' + Date.now();

      const response = await fetch(
        `${BASE_URL}/api/admin/id-badges/messages/${testMessageId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_text: updatedText }),
        }
      );

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message.message_text).toBe(updatedText);
    });

    testOrSkip('should return 400 for empty message text', async () => {
      if (!testMessageId) {
        console.warn('No test message ID available, skipping test');
        return;
      }

      const response = await fetch(
        `${BASE_URL}/api/admin/id-badges/messages/${testMessageId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_text: '' }),
        }
      );

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('empty');
    });

    testOrSkip('should return 404 for non-existent message ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await fetch(
        `${BASE_URL}/api/admin/id-badges/messages/${fakeId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_text: 'Test' }),
        }
      );

      // Expect 404 or 500 (depending on DB error handling)
      expect([404, 500]).toContain(response.status);
    });

    testOrSkip('should preserve message_key and description after update', async () => {
      if (!testMessageId) {
        console.warn('No test message ID available, skipping test');
        return;
      }

      // Get original data
      const getResponse = await fetch(`${BASE_URL}/api/admin/id-badges/messages`);
      const getData = await getResponse.json();
      const originalMessage = getData.messages.find((m: any) => m.id === testMessageId);

      // Update message text
      const updatedText = 'E2E Preservation Test ' + Date.now();
      await fetch(
        `${BASE_URL}/api/admin/id-badges/messages/${testMessageId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_text: updatedText }),
        }
      );

      // Get updated data
      const getResponseAfter = await fetch(`${BASE_URL}/api/admin/id-badges/messages`);
      const getDataAfter = await getResponseAfter.json();
      const updatedMessage = getDataAfter.messages.find((m: any) => m.id === testMessageId);

      expect(updatedMessage.message_key).toBe(originalMessage.message_key);
      expect(updatedMessage.description).toBe(originalMessage.description);
      expect(updatedMessage.supports_variables).toBe(originalMessage.supports_variables);
    });
  });

  describe('UI Integration Tests', () => {
    testOrSkip('should verify all required message keys exist', async () => {
      const requiredKeys = [
        'upload_disclaimer',
        'submit_button_label',
        'pending_status_text',
        'in_app_submission_notification',
        'approved_email_subject',
        'approved_email_body',
        'rejected_email_subject',
        'rejected_email_body',
        'in_app_approved_notification',
        'in_app_rejected_notification',
        'web_push_approved',
        'web_push_rejected',
      ];

      const response = await fetch(`${BASE_URL}/api/admin/id-badges/messages`);
      const data = await response.json();
      
      const existingKeys = data.messages.map((m: any) => m.message_key);
      
      requiredKeys.forEach((key) => {
        expect(existingKeys).toContain(key);
      });
    });

    testOrSkip('should verify template variable support flags are correct', async () => {
      const response = await fetch(`${BASE_URL}/api/admin/id-badges/messages`);
      const data = await response.json();
      
      // Messages that should support variables
      const shouldSupportVars = [
        'approved_email_body',
        'rejected_email_body',
        'in_app_approved_notification',
        'in_app_rejected_notification',
        'web_push_approved',
        'web_push_rejected',
      ];

      shouldSupportVars.forEach((key) => {
        const message = data.messages.find((m: any) => m.message_key === key);
        expect(message).toBeDefined();
        expect(message.supports_variables).toBe(true);
      });
    });
  });
});
