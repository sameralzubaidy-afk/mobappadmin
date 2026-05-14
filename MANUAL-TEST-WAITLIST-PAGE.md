# Manual Test Guide: Waitlist Page

**Feature:** Admin waitlist viewer for users requesting inactive ZIP codes  
**Route:** `/waitlist`  
**Created:** May 12, 2026  
**Related Files:**
- `src/app/waitlist/page.tsx`
- `src/app/api/admin/waitlist/route.ts`
- `src/components/layout/Sidebar.tsx`

---

## Prerequisites

### 1. Admin Access Required
- You must be logged in as an admin user
- Your user profile must have `user_metadata.is_admin = true` in Supabase auth

**To verify admin status:**
```sql
-- Run in Supabase SQL Editor
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'is_admin' AS is_admin
FROM auth.users
WHERE email = 'your-email@example.com';
```

If `is_admin` is not `'true'`, set it:
```sql
-- Run in Supabase SQL Editor
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"is_admin": true}'::jsonb
WHERE email = 'your-email@example.com';
```

### 2. Test Data Setup

**Create test waitlist entries:**
```sql
-- Run in Supabase SQL Editor
INSERT INTO public.zip_waitlist (user_id, email, requested_zip, assigned_node_id, status)
VALUES
  -- User 1: Pending entry
  (
    (SELECT id FROM auth.users LIMIT 1),
    'test-user-1@example.com',
    '10001',
    (SELECT id FROM public.nodes WHERE is_active = true LIMIT 1),
    'pending'
  ),
  -- User 2: Notified entry
  (
    (SELECT id FROM auth.users LIMIT 1 OFFSET 1),
    'test-user-2@example.com',
    '90210',
    (SELECT id FROM public.nodes WHERE is_active = true LIMIT 1),
    'notified'
  ),
  -- User 3: Joined entry
  (
    (SELECT id FROM auth.users LIMIT 1 OFFSET 2),
    'test-user-3@example.com',
    '60601',
    (SELECT id FROM public.nodes WHERE is_active = true LIMIT 1),
    'joined'
  )
ON CONFLICT (user_id, requested_zip) DO NOTHING;
```

**Verify test data exists:**
```sql
SELECT 
  z.id,
  z.email,
  z.requested_zip,
  z.status,
  z.created_at,
  n.name AS assigned_node_name
FROM public.zip_waitlist z
LEFT JOIN public.nodes n ON n.id = z.assigned_node_id
ORDER BY z.created_at DESC
LIMIT 10;
```

---

## Test Cases

### TC-01: Navigation & Page Access

**Steps:**
1. Log in to admin portal at `http://localhost:3001/auth/login`
2. Verify sidebar contains "Waitlist" link below "Nodes"
3. Click "Waitlist" link

**Expected Results:**
- ✅ Page loads at `http://localhost:3001/waitlist`
- ✅ Page title shows "ZIP Waitlist"
- ✅ Subtitle shows "Users requesting inactive ZIP codes and their fallback node assignment"
- ✅ Four metric cards display: Total, Pending (orange), Notified (blue), Joined (green)
- ✅ No console errors in browser DevTools

**Debug if failing:**
- Check browser Network tab for `/api/admin/waitlist` request
- Check response status (should be 200, not 401/403)
- If 403: verify `is_admin` metadata is set correctly (see Prerequisites)

---

### TC-02: Table Display & Data Loading

**Steps:**
1. Navigate to `/waitlist` page
2. Observe the table content

**Expected Results:**
- ✅ Table has 7 columns: User | Requested ZIP | Email | Assigned Node | Status | Requested At | User ID
- ✅ Entries from test data appear in table
- ✅ "User" column shows display name from `profiles` table (or "Unknown user" if null)
- ✅ "Status" column shows color-coded chips:
  - Pending = Amber background (#FEF3C7) with amber text
  - Notified = Blue background (#DBEAFE) with blue text
  - Joined = Green background (#D1FAE5) with green text
- ✅ "Requested At" column shows formatted date (e.g., "May 12, 2026")
- ✅ Pagination shows "Page 1 of X" at bottom

**Debug if failing:**
- Open browser DevTools → Network tab
- Find `/api/admin/waitlist` request
- Check response payload:
  ```json
  {
    "entries": [
      {
        "id": "...",
        "user_id": "...",
        "user_display_name": "John Doe", // or null
        "email": "test@example.com",
        "requested_zip": "10001",
        "assigned_node_id": "...",
        "status": "pending",
        "created_at": "2026-05-12T...",
        "nodes": { "name": "Test Node", ... }
      }
    ],
    "total": 3,
    "page": 1,
    "total_pages": 1
  }
  ```
- If `entries` array is empty but test data exists:
  - Check server logs (terminal running `npm run dev`)
  - Verify RLS policy allows admin SELECT: `zip_waitlist_admin_all`

---

### TC-03: Search Filter

**Steps:**
1. In search box, type a test email (e.g., `test-user-1`)
2. Press Enter or wait for auto-search
3. Click "Apply" button

**Expected Results:**
- ✅ Table filters to show only entries matching the email substring
- ✅ Entries with non-matching emails are hidden
- ✅ Total count updates to reflect filtered results
- ✅ Pagination updates if needed

**Additional test:**
1. Clear search box
2. Type a ZIP code (e.g., `10001`)
3. Click "Apply"

**Expected Results:**
- ✅ Table filters to show only entries matching the ZIP code
- ✅ Both email AND ZIP search work independently

---

### TC-04: Status Filter

**Steps:**
1. Click the status dropdown (shows "All statuses" by default)
2. Select "Pending"
3. Click "Apply"

**Expected Results:**
- ✅ Table shows only entries with status = 'pending'
- ✅ Amber status chip appears for all visible rows
- ✅ "Pending (page)" metric card shows same count as filtered table

**Repeat for:**
- Select "Notified" → only blue chips visible
- Select "Joined" → only green chips visible
- Select "All statuses" → all entries visible again

---

### TC-05: Pagination

**Prerequisites:** Insert enough test data to span multiple pages (25+ entries)

**Steps:**
1. Navigate to `/waitlist` page
2. Scroll to bottom of page
3. Click "Next" button

**Expected Results:**
- ✅ Page number increments (Page 1 → Page 2)
- ✅ Table content updates with next 25 entries
- ✅ "Previous" button becomes enabled
- ✅ URL updates with `?page=2` query param (if implemented)

**Steps:**
1. Click "Previous" button

**Expected Results:**
- ✅ Page number decrements (Page 2 → Page 1)
- ✅ Table content shows first 25 entries again
- ✅ "Previous" button becomes disabled

---

### TC-06: Refresh Button

**Steps:**
1. While viewing the waitlist page, manually insert a new entry via SQL:
   ```sql
   INSERT INTO public.zip_waitlist (user_id, email, requested_zip, status)
   VALUES (
     (SELECT id FROM auth.users LIMIT 1),
     'new-entry@example.com',
     '12345',
     'pending'
   );
   ```
2. Click the green "Refresh" button in top-right corner

**Expected Results:**
- ✅ Table reloads
- ✅ New entry appears in table
- ✅ Total count increments
- ✅ Brief loading state shown (if implemented)

---

### TC-07: Display Name Enrichment

**Setup:**
1. Find a user_id from the waitlist table:
   ```sql
   SELECT user_id FROM zip_waitlist LIMIT 1;
   ```
2. Update their profile display_name:
   ```sql
   UPDATE profiles
   SET display_name = 'Test User Display Name'
   WHERE user_id = '<user_id_from_step_1>';
   ```
3. Refresh the waitlist page

**Expected Results:**
- ✅ "User" column shows "Test User Display Name" instead of "Unknown user"

**Additional test:**
1. Set display_name to NULL for a user:
   ```sql
   UPDATE profiles
   SET display_name = NULL
   WHERE user_id = '<user_id>';
   ```
2. Refresh the waitlist page

**Expected Results:**
- ✅ "User" column shows "Unknown user" as fallback

---

### TC-08: Combined Filters

**Steps:**
1. Set search to `test-user`
2. Set status filter to `pending`
3. Click "Apply"

**Expected Results:**
- ✅ Table shows only entries that match BOTH filters (email/ZIP contains "test-user" AND status = 'pending')
- ✅ Count reflects combined filter result

---

### TC-09: Empty State

**Steps:**
1. Apply filters that return no results (e.g., search for `nonexistent-email-12345`)
2. Click "Apply"

**Expected Results:**
- ✅ Table shows message: "No waitlist entries found for the selected filters."
- ✅ Pagination shows "Page 1 of 1"
- ✅ No error in console

---

### TC-10: API Authorization

**Steps:**
1. Log out of admin portal
2. Manually navigate to `http://localhost:3001/waitlist`

**Expected Results:**
- ✅ Redirected to `/auth/login` page (if auth middleware is configured)
- OR
- ✅ Page shows empty table with error in console (if no redirect)

**Steps:**
1. In browser DevTools Console, run:
   ```javascript
   fetch('/api/admin/waitlist')
     .then(r => r.json())
     .then(console.log)
   ```

**Expected Results:**
- ✅ Response returns `{ "error": "Unauthorized" }` with status 401

---

## Known Issues & Limitations

1. **User Display Name NULL:**
   - If a user hasn't completed profile setup, `display_name` will be NULL
   - Table shows "Unknown user" as fallback
   - This is expected behavior

2. **RLS Policy Dependency:**
   - Admin access requires `is_admin()` function to return true
   - Function checks `raw_user_meta_data->>'is_admin' = 'true'`
   - If admin can't see data, verify this metadata field

3. **Real-time Updates:**
   - Page does not auto-refresh when new waitlist entries are added
   - User must manually click "Refresh" button

---

## Troubleshooting

### Issue: Empty table despite test data existing

**Diagnosis:**
1. Open browser DevTools → Network tab
2. Find `/api/admin/waitlist` request
3. Check response status and body

**If 401 Unauthorized:**
- Not logged in → go to `/auth/login`

**If 403 Forbidden:**
- Logged in but not admin → set `is_admin` metadata (see Prerequisites)

**If 200 but empty entries array:**
- Check server logs (terminal running `npm run dev`)
- Look for log: `[Admin Waitlist API] Found X waitlist entries (total: Y)`
- If X = 0, verify test data exists:
  ```sql
  SELECT COUNT(*) FROM public.zip_waitlist;
  ```
- Check RLS policies:
  ```sql
  SELECT policyname, cmd, permissive, roles, qual
  FROM pg_policies
  WHERE tablename = 'zip_waitlist';
  ```
  - Should have policy: `zip_waitlist_admin_all` for ALL with `is_admin(auth.uid())`

### Issue: "Unknown user" for all entries

**Diagnosis:**
1. Check if `profiles` table has `display_name` populated:
   ```sql
   SELECT user_id, display_name
   FROM profiles
   WHERE user_id IN (SELECT user_id FROM zip_waitlist);
   ```
2. If all NULL, this is normal for users who haven't completed onboarding

**Fix (for testing only):**
```sql
UPDATE profiles
SET display_name = 'Test User ' || SUBSTRING(user_id::text, 1, 4)
WHERE user_id IN (SELECT user_id FROM zip_waitlist);
```

### Issue: Status chips wrong color

**Expected colors:**
- Pending: `bg-amber-100 text-amber-800` (warm yellow)
- Notified: `bg-blue-100 text-blue-800` (sky blue)
- Joined: `bg-emerald-100 text-emerald-800` (green)

If colors are wrong, check Tailwind CSS classes in `src/app/waitlist/page.tsx`

---

## Cleanup After Testing

**Remove test data:**
```sql
DELETE FROM public.zip_waitlist
WHERE email LIKE 'test-%@example.com' OR email = 'new-entry@example.com';
```

**Reset admin flag (if needed):**
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'is_admin'
WHERE email = 'your-email@example.com';
```

---

## Related Documentation

- Module: NODE-003 (Waitlist Management)
- Database Table: `public.zip_waitlist` (migration `006_resolve_active_node_and_waitlist.sql`)
- Mobile Implementation: `p2p-kids-marketplace/src/screens/profile/ProfileSetupScreen.tsx`
- Waitlist Service: `p2p-kids-marketplace/src/services/waitlist.ts`

---

## Success Criteria

All test cases (TC-01 through TC-10) must PASS before considering this feature production-ready.

**Verification Checklist:**
- [ ] TC-01: Navigation & Page Access
- [ ] TC-02: Table Display & Data Loading
- [ ] TC-03: Search Filter
- [ ] TC-04: Status Filter
- [ ] TC-05: Pagination
- [ ] TC-06: Refresh Button
- [ ] TC-07: Display Name Enrichment
- [ ] TC-08: Combined Filters
- [ ] TC-09: Empty State
- [ ] TC-10: API Authorization
