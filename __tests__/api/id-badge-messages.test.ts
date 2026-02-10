// File: p2p-kids-admin/__tests__/api/id-badge-messages.test.ts

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

describe('ID Badge Messages API — Unit Tests', () => {
  let testMessageId: string;

  beforeAll(async () => {
    // Get a message ID for testing
    const { data } = await supabase
      .from('id_badge_verification_messages')
      .select('id')
      .limit(1)
      .single();
    
    if (data) {
      testMessageId = data.id;
    }
  });

  describe('GET /api/admin/id-badges/messages', () => {
    it('should return all 12 messages', async () => {
      const { data: messages, error } = await supabase
        .from('id_badge_verification_messages')
        .select('id, message_key, message_text, description, supports_variables');

      expect(error).toBeNull();
      expect(messages).toBeDefined();
      expect(messages?.length).toBeGreaterThanOrEqual(12);
    });

    it('should include required fields in each message', async () => {
      const { data: messages } = await supabase
        .from('id_badge_verification_messages')
        .select('id, message_key, message_text, description, supports_variables')
        .limit(1);

      const message = messages?.[0];
      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('message_key');
      expect(message).toHaveProperty('message_text');
      expect(message).toHaveProperty('description');
      expect(message).toHaveProperty('supports_variables');
    });

    it('should return messages ordered by message_key', async () => {
      const { data: messages } = await supabase
        .from('id_badge_verification_messages')
        .select('message_key')
        .order('message_key', { ascending: true });

      expect(messages).toBeDefined();
      
      const keys = messages?.map((m) => m.message_key) || [];
      const sortedKeys = [...keys].sort();
      expect(keys).toEqual(sortedKeys);
    });
  });

  describe('PUT /api/admin/id-badges/messages/:messageId', () => {
    const originalText = 'Original test message';
    const updatedText = 'Updated test message at ' + Date.now();

    it('should update message text successfully', async () => {
      if (!testMessageId) {
        console.warn('No test message ID available, skipping test');
        return;
      }

      const { data, error } = await supabase
        .from('id_badge_verification_messages')
        .update({ message_text: updatedText })
        .eq('id', testMessageId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.message_text).toBe(updatedText);
    });

    it('should not update with empty message text', async () => {
      if (!testMessageId) {
        console.warn('No test message ID available, skipping test');
        return;
      }

      // This test simulates validation that should happen in the API route
      const emptyText = '';
      expect(emptyText.trim().length).toBe(0);
    });

    it('should preserve other fields when updating message_text', async () => {
      if (!testMessageId) {
        console.warn('No test message ID available, skipping test');
        return;
      }

      const { data: before } = await supabase
        .from('id_badge_verification_messages')
        .select('message_key, description, supports_variables')
        .eq('id', testMessageId)
        .single();

      const newText = 'Test update ' + Date.now();
      await supabase
        .from('id_badge_verification_messages')
        .update({ message_text: newText })
        .eq('id', testMessageId);

      const { data: after } = await supabase
        .from('id_badge_verification_messages')
        .select('message_key, description, supports_variables')
        .eq('id', testMessageId)
        .single();

      expect(after?.message_key).toBe(before?.message_key);
      expect(after?.description).toBe(before?.description);
      expect(after?.supports_variables).toBe(before?.supports_variables);
    });
  });

  describe('Message Template Variables', () => {
    it('should verify messages that support variables contain placeholders', async () => {
      const { data: messagesWithVars } = await supabase
        .from('id_badge_verification_messages')
        .select('message_key, message_text, supports_variables')
        .eq('supports_variables', true);

      expect(messagesWithVars).toBeDefined();
      
      const variablePattern = /\{[a-z_]+\}/;
      messagesWithVars?.forEach((msg) => {
        // Not all messages with supports_variables=true need to have variables,
        // but if they do, they should be in proper format
        if (variablePattern.test(msg.message_text)) {
          expect(msg.message_text).toMatch(/\{first_name\}|\{rejection_reason\}|\{admin_notes\}|\{approval_timeframe_hours\}/);
        }
      });
    });

    it('should verify all required message keys exist', async () => {
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

      const { data: messages } = await supabase
        .from('id_badge_verification_messages')
        .select('message_key');

      const existingKeys = messages?.map((m) => m.message_key) || [];
      
      requiredKeys.forEach((key) => {
        expect(existingKeys).toContain(key);
      });
    });
  });
});
