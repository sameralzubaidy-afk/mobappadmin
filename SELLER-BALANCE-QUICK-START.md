# 🚀 QUICK START: Seller Balance & Withdrawal Testing

## ⚡ Fastest Path to Testing

### **Step 1: Apply Migration** (30 seconds)
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
supabase db reset
```

### **Step 2: Verify Migration** (10 seconds)
```sql
-- Run in Supabase SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'seller_balance';
-- Should return: seller_balance
```

### **Step 3: Seed Test Balance** (Optional - 10 seconds)
```sql
-- Run as authenticated user in SQL Editor
INSERT INTO seller_balance (user_id, available_balance_cents, lifetime_earnings_cents)
VALUES (auth.uid(), 5000, 10000);
```

### **Step 4: Run App** (30 seconds)
```bash
cd p2p-kids-marketplace
yarn typecheck  # Should PASS
yarn ios  # or yarn android
```

### **Step 5: Navigate to Balance** (10 seconds)
1. Open app → Dashboard
2. Tap "💳 Payouts" button in header
3. ✅ **Expected:** See balance card at top with:
   - Available to Withdraw: $50.00
   - Pending: $0.00
   - Lifetime Earnings: $100.00
   - Green "💳 Withdraw Now" button

---

## 🧪 Key Test Scenarios

### **Test A: Balance Updates on Trade Completion**
```
1. Complete a trade as BUYER (confirm completion)
2. SELLER opens Payout Settings
3. ✅ Balance increased by trade amount
```

**Expected Result:**
```
Available Balance: +$20.00 (from trade)
Lifetime Earnings: +$20.00 (cumulative)
Total Trades Completed: +1
```

### **Test B: Withdrawal Request**
```
1. Seller with $50.00 balance
2. Has verified PayPal method (primary)
3. Tap "💳 Withdraw Now"
4. Review fees in modal
5. Tap "Confirm Withdrawal"
```

**Expected Result:**
```
✅ Alert: "Withdrawal Requested... You will receive $49.00"
✅ Balance: $0.00 (deducted)
✅ Recent Withdrawals: Shows new payout (status: Pending)
```

### **Test C: Withdrawal Validation**
```
# No balance
Tap withdraw → Alert: "No available balance"

# No payout method
Tap withdraw → Alert: "Please add payout method"

# Under minimum ($5)
Attempt $3 withdrawal → Error: "Minimum $5.00"
```

---

## 🔍 Quick Verification Queries

### **Check Your Balance**
```sql
SELECT 
  available_balance_cents / 100.0 AS available,
  lifetime_earnings_cents / 100.0 AS lifetime,
  total_trades_completed
FROM seller_balance
WHERE user_id = auth.uid();
```

### **Check Recent Payouts**
```sql
SELECT 
  net_amount_cents / 100.0 AS amount,
  status,
  created_at
FROM seller_payouts
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;
```

### **Manually Trigger Balance Update** (Testing Only)
```sql
-- Simulate trade completion
UPDATE trades 
SET status = 'completed', completed_at = NOW()
WHERE id = 'YOUR_TRADE_ID' AND seller_id = auth.uid();

-- Check balance increased
SELECT available_balance_cents / 100.0 FROM seller_balance WHERE user_id = auth.uid();
```

---

## 📱 UI Visual Checklist

### **Balance Card (Top Section)**
```
┌──────────────────────────────────────┐
│ 💰 Your Earnings                     │
├──────────────────────────────────────┤
│ Available to Withdraw:     $47.50    │  ← Green, large
│ Pending (In Progress):      $22.00   │  ← Black, medium
│ Lifetime Earnings:         $342.00   │  ← Black, medium
├──────────────────────────────────────┤
│         [💳 Withdraw Now]            │  ← Green button
└──────────────────────────────────────┘
```

### **Recent Withdrawals**
```
┌──────────────────────────────────────┐
│ Recent Withdrawals                   │
├──────────────────────────────────────┤
│ $46.53          [Pending]            │  ← Blue badge
│ 12/28/2025      Fee: $0.97           │
├──────────────────────────────────────┤
│ $23.50          [Completed]          │  ← Green badge
│ 12/25/2025      Fee: $0.50           │
└──────────────────────────────────────┘
```

### **Withdraw Modal**
```
┌──────────────────────────────────────┐
│ Withdraw Funds                       │
├──────────────────────────────────────┤
│ Available Balance:          $47.50   │
│ Payout Fee:                 -$0.97   │
│ ────────────────────────────────     │
│ You'll Receive:             $46.53   │  ← Green, bold
├──────────────────────────────────────┤
│ Payout Method:                       │
│ PayPal - seller@example.com          │  ← Blue box
├──────────────────────────────────────┤
│   [Cancel]   [Confirm Withdrawal]    │
└──────────────────────────────────────┘
```

---

## ⚠️ Common Issues & Fixes

### **Issue: Balance not updating after trade completion**
**Cause:** Trigger not firing or trade not actually completed
**Fix:**
```sql
-- Check trigger exists
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'trades'::regclass 
AND tgname = 'trigger_update_seller_balance_on_completion';

-- Check trade status
SELECT id, status, completed_at FROM trades WHERE seller_id = auth.uid();

-- Manually update if needed (testing only)
UPDATE trades SET status = 'completed', completed_at = NOW() WHERE id = 'TRADE_ID';
```

### **Issue: Withdraw button not appearing**
**Cause:** balance.available_balance_cents === 0
**Fix:**
```sql
-- Add test balance
INSERT INTO seller_balance (user_id, available_balance_cents)
VALUES (auth.uid(), 5000)
ON CONFLICT (user_id) DO UPDATE 
SET available_balance_cents = 5000;
```

### **Issue: "No payout method" error**
**Cause:** No verified primary payout method
**Fix:**
1. Tap "+ Add Payout Method"
2. Add PayPal with test email
3. Manually verify in DB:
```sql
UPDATE seller_payout_methods 
SET is_verified = true, is_primary = true
WHERE user_id = auth.uid();
```

### **Issue: TypeScript errors**
**Cause:** Missing imports or type definitions
**Fix:**
```bash
cd p2p-kids-marketplace
yarn typecheck  # See exact errors
# Most likely: missing SellerBalance/SellerPayout type imports
```

---

## 📊 Success Criteria

✅ Migration applied without errors  
✅ `seller_balance` table exists  
✅ Trigger attached to `trades` table  
✅ RPC function `request_seller_payout` callable  
✅ App compiles (yarn typecheck passes)  
✅ Balance card displays at top of Payout Settings  
✅ Withdraw button appears when balance > $0  
✅ Withdraw modal shows fee breakdown  
✅ Balance updates when trade completed by buyer  
✅ Recent withdrawals list displays  
✅ Payout records created with correct amounts  

---

## 🎯 Next Steps After Testing

1. **If all tests pass:**
   - Merge to `main` branch
   - Deploy to staging
   - Test with real Stripe/PayPal sandbox accounts

2. **Implement remaining modules:**
   - PAY-004: Stripe Connect onboarding
   - PAY-005: PayPal/Venmo payout API integration
   - PAY-007: Webhook reconciliation

3. **Production deployment:**
   - Apply migration to production Supabase
   - Monitor balance updates in production
   - Track payout success rates

---

**Files Modified:**
- ✅ `supabase/migrations/074_seller_balance_and_withdrawal.sql`
- ✅ `p2p-kids-marketplace/src/services/sellerBalance.ts`
- ✅ `p2p-kids-marketplace/src/screens/seller/PayoutSettingsScreen.tsx`

**Documentation:**
- ✅ `SELLER-BALANCE-WITHDRAWAL-COMPLETE.md` (Full implementation guide)
- ✅ This file (Quick start testing guide)

**Ready to test!** 🚀
