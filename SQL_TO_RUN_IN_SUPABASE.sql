-- SUPABASE PRODUCTION SQL: Referral System V2 Upgrade
-- Run this in Supabase SQL Editor before testing the app

-- =============================================================================
-- 1. UPGRADE EXISTING REFERRALS TABLE TO V2 SPEC
-- =============================================================================

-- Add missing columns for V2 spec
ALTER TABLE referrals 
ADD COLUMN IF NOT EXISTS trial_extension_applied BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reward_granted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Update status enum to match V2 spec (pending, completed, expired)
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE referrals ADD CONSTRAINT referrals_status_check 
  CHECK (status IN ('pending', 'completed', 'expired'));

-- Add constraint to prevent self-referral
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_no_self_referral;
ALTER TABLE referrals ADD CONSTRAINT referrals_no_self_referral 
  CHECK (referrer_user_id != referred_user_id);

-- Create unique constraint on referee_id (one referrer per referee)
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referred_user_id_key;
ALTER TABLE referrals ADD CONSTRAINT referrals_referred_user_id_key 
  UNIQUE(referred_user_id);

-- =============================================================================
-- 2. CREATE REFERRAL_CODES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT code_length CHECK (char_length(code) = 8)
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_code_idx ON referral_codes(LOWER(code));
CREATE INDEX IF NOT EXISTS referral_codes_user_idx ON referral_codes(user_id);

-- Enable RLS
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referral code" ON referral_codes;
CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- 3. MIGRATE EXISTING REFERRAL CODES FROM PROFILES
-- =============================================================================

-- Migrate existing referral codes from profiles table to referral_codes table
-- Only migrate codes that are exactly 8 characters (V2 spec compliant)
INSERT INTO referral_codes (user_id, code, created_at)
SELECT user_id, LOWER(referral_code) as code, created_at
FROM profiles 
WHERE referral_code IS NOT NULL 
  AND referral_code != ''
  AND char_length(referral_code) = 8
ON CONFLICT (code) DO NOTHING;

-- For users with invalid codes (not 8 chars), generate new valid codes
INSERT INTO referral_codes (user_id, code)
SELECT user_id, generate_referral_code()
FROM profiles 
WHERE user_id NOT IN (SELECT user_id FROM referral_codes)
  AND (referral_code IS NULL 
    OR referral_code = '' 
    OR char_length(referral_code) != 8)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 4. CREATE V2 RPC FUNCTIONS
-- =============================================================================

-- RPC: Generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code (lowercase for consistency)
    v_code := LOWER(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE LOWER(code) = v_code) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- RPC: Create referral code for user
CREATE OR REPLACE FUNCTION create_referral_code(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Check if user already has a code
  SELECT code INTO v_code FROM referral_codes WHERE user_id = p_user_id;
  
  IF v_code IS NOT NULL THEN
    RETURN jsonb_build_object('code', v_code, 'created', false);
  END IF;
  
  -- Generate new code
  v_code := generate_referral_code();
  
  -- Insert code
  INSERT INTO referral_codes (user_id, code)
  VALUES (p_user_id, v_code);
  
  RETURN jsonb_build_object('code', v_code, 'created', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Apply referral code on signup
CREATE OR REPLACE FUNCTION apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_referee_email TEXT;
  v_referrer_email TEXT;
BEGIN
  -- Normalize code to lowercase
  p_referral_code := LOWER(TRIM(p_referral_code));
  
  -- Get referrer from code
  SELECT user_id INTO v_referrer_id
  FROM referral_codes
  WHERE LOWER(code) = p_referral_code;
  
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  -- Prevent self-referral (same user ID)
  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Prevent self-referral (same email) 
  SELECT email INTO v_referee_email FROM auth.users WHERE id = p_referee_id;
  SELECT email INTO v_referrer_email FROM auth.users WHERE id = v_referrer_id;
  
  IF v_referee_email = v_referrer_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  -- Check if referee already has a referrer
  IF EXISTS(SELECT 1 FROM referrals WHERE referred_user_id = p_referee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied');
  END IF;
  
  -- Create referral relationship
  INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status)
  VALUES (v_referrer_id, p_referee_id, p_referral_code, 'pending');
  
  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'message', 'Referral code applied successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. CREATE TRIGGER TO AUTO-GENERATE REFERRAL CODES
-- =============================================================================

-- NOTE:
-- This trigger is OPTIONAL. If your project already uses public.handle_new_user()
-- (the canonical auth.users trigger) to create referral codes, you should NOT
-- rely on an extra auth.users trigger here.
--
-- If this trigger exists and throws, Supabase signup will fail with:
--   "Database error saving new user"

CREATE OR REPLACE FUNCTION public.create_referral_code_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    PERFORM public.create_referral_code(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Never block auth signup for referral code issues
    RAISE WARNING 'Referral code trigger failed for user %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_referral_code_trigger ON auth.users;
CREATE TRIGGER create_referral_code_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_referral_code_on_signup();

-- =============================================================================
-- VERIFICATION QUERIES (Run these to confirm setup worked)
-- =============================================================================

-- Check referral_codes table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'referral_codes' 
ORDER BY ordinal_position;

-- Check referrals table structure  
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'referrals' 
ORDER BY ordinal_position;

-- Test referral code generation (should return an 8-character code)
SELECT generate_referral_code() as test_code;

-- Count existing referral codes migrated from profiles
SELECT COUNT(*) as migrated_codes FROM referral_codes;

-- Verify RLS policies
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('referral_codes', 'referrals');

-- =============================================================================
-- PATCH (2026-01-29): Fix profiles.referral_code mismatch + populate profiles.referred_by
-- =============================================================================
-- Why:
-- - profiles.referral_code was still being generated by legacy trigger (uppercase)
--   while the app displays referral_codes.code (lowercase).
-- - apply_referral_code() created referrals rows but did NOT set profiles.referred_by.
--
-- Run in two blocks.

-- =============================================================================
-- BLOCK 1 — Functions (safe to re-run)
-- =============================================================================

-- IMPORTANT: Remove the legacy auth.users referral-code trigger.
-- It can cause "Database error saving new user" if it throws during signup.
-- Referral-code creation is owned by public.handle_new_user() below.
DROP TRIGGER IF EXISTS create_referral_code_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.create_referral_code_on_signup();
DROP FUNCTION IF EXISTS create_referral_code_on_signup();

-- IMPORTANT: Remove legacy profiles trigger that generates UPPERCASE codes in profiles.referral_code.
-- This conflicts with handle_new_user which creates lowercase codes in referral_codes table.
-- Result: screen shows one code, database has another.
DROP TRIGGER IF EXISTS trigger_generate_referral_code_on_profile_creation ON public.profiles;
DROP FUNCTION IF EXISTS public.generate_referral_code_on_profile_creation();
DROP FUNCTION IF EXISTS generate_referral_code_on_profile_creation();

-- Update apply_referral_code to also populate profiles.referred_by
CREATE OR REPLACE FUNCTION apply_referral_code(
  p_referee_id UUID,
  p_referral_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_referee_email TEXT;
  v_referrer_email TEXT;
BEGIN
  p_referral_code := LOWER(TRIM(p_referral_code));
  
  SELECT user_id INTO v_referrer_id
  FROM referral_codes
  WHERE LOWER(code) = p_referral_code
  LIMIT 1;
  
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  
  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  SELECT email INTO v_referee_email FROM auth.users WHERE id = p_referee_id;
  SELECT email INTO v_referrer_email FROM auth.users WHERE id = v_referrer_id;
  
  IF v_referee_email = v_referrer_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
  END IF;
  
  IF EXISTS(SELECT 1 FROM referrals WHERE referred_user_id = p_referee_id) THEN
    UPDATE profiles
    SET referred_by = v_referrer_id
    WHERE user_id = p_referee_id
      AND referred_by IS NULL;

    RETURN jsonb_build_object('success', false, 'error', 'Referral code already applied');
  END IF;
  
  INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status)
  VALUES (v_referrer_id, p_referee_id, p_referral_code, 'pending');

  UPDATE profiles
  SET referred_by = v_referrer_id
  WHERE user_id = p_referee_id
    AND referred_by IS NULL;
  
  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'message', 'Referral code applied successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update handle_new_user so profiles.referral_code matches referral_codes.code
-- and referral code from signup metadata gets applied server-side.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
  v_dob DATE;
  v_age INTEGER;
  v_referral_code TEXT;
  v_referral_input TEXT;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    'User'
  );

  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.phone
  );

  v_referral_input := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')), '');

  IF (NEW.raw_user_meta_data->>'dob') IS NOT NULL AND (NEW.raw_user_meta_data->>'dob') <> '' THEN
    BEGIN
      v_dob := (NEW.raw_user_meta_data->>'dob')::date;
      v_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob))::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
      v_age := NULL;
    END;
  END IF;

  BEGIN
    SELECT (create_referral_code(NEW.id)->>'code') INTO v_referral_code;
  EXCEPTION WHEN OTHERS THEN
    v_referral_code := NULL;
    RAISE WARNING 'Referral code creation failed for user %: %', NEW.id, SQLERRM;
  END;

  INSERT INTO public.profiles (
    user_id,
    name,
    email,
    phone,
    dob,
    age,
    phone_verified,
    phone_verified_at,
    referral_code
  )
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    v_phone,
    v_dob,
    v_age,
    false,
    NULL,
    v_referral_code
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    dob = EXCLUDED.dob,
    age = EXCLUDED.age,
    referral_code = COALESCE(EXCLUDED.referral_code, public.profiles.referral_code);

  IF v_referral_input IS NOT NULL THEN
    BEGIN
      PERFORM apply_referral_code(NEW.id, v_referral_input);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Referral code apply failed for user %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- BLOCK 2 — Backfills (safe to re-run)
-- =============================================================================

-- Dedupe referral_codes: enforce ONE code per user.
-- Keep the row that matches profiles.referral_code when possible; otherwise keep the earliest.
WITH ranked AS (
  SELECT
    rc.id,
    rc.user_id,
    ROW_NUMBER() OVER (
      PARTITION BY rc.user_id
      ORDER BY
        CASE WHEN p.user_id IS NOT NULL AND LOWER(rc.code) = LOWER(p.referral_code) THEN 0 ELSE 1 END,
        rc.created_at ASC,
        rc.id ASC
    ) AS rn
  FROM public.referral_codes rc
  LEFT JOIN public.profiles p ON p.user_id = rc.user_id
)
DELETE FROM public.referral_codes rc
USING ranked r
WHERE rc.id = r.id
  AND r.rn > 1;

-- One referral code per user going forward
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_user_unique_idx ON public.referral_codes(user_id);

-- Sync profiles.referral_code to referral_codes.code (fix mismatch)
UPDATE public.profiles p
SET referral_code = rc.code
FROM public.referral_codes rc
WHERE rc.user_id = p.user_id
  AND (p.referral_code IS NULL OR LOWER(p.referral_code) <> LOWER(rc.code));

-- Populate profiles.referred_by from referrals
UPDATE public.profiles p
SET referred_by = r.referrer_user_id
FROM public.referrals r
WHERE r.referred_user_id = p.user_id
  AND p.referred_by IS NULL;

-- Verification
-- 1) Mismatch count should be 0
-- SELECT COUNT(*) AS mismatches
-- FROM public.profiles p
-- JOIN public.referral_codes rc ON rc.user_id = p.user_id
-- WHERE LOWER(p.referral_code) <> LOWER(rc.code);