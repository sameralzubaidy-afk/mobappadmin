# Setup Admin Role - Quick Fix

The error means you're authenticated in the browser but don't have the admin role assigned yet.

## Step 1: Get Your User ID

In Supabase Dashboard:
1. Go to **Authentication** → **Users**
2. Find your user and copy the **UID** (looks like: `550e8400-e29b-41d4-a716-446655440000`)

## Step 2: Assign Admin Role

In Supabase Dashboard → **SQL Editor**, run:

```sql
-- Insert your user ID here (replace the UUID)
INSERT INTO role_based_access_control (user_id, role)
VALUES ('YOUR_USER_ID_HERE', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify it worked:
SELECT * FROM role_based_access_control WHERE role = 'admin';
```

## Step 3: Test

1. Go back to http://localhost:3001/nodes
2. Try creating a node again
3. It should work now! ✅

---

## Troubleshooting

**Still getting "User not authenticated"?**

Try this in Supabase SQL Editor:

```sql
-- Check if your user exists
SELECT id, email FROM auth.users;

-- Check admin roles
SELECT * FROM role_based_access_control;
```

If the role shows up correctly, try:
1. **Refresh the page** (Ctrl+R or Cmd+R)
2. **Clear browser cache** (or hard refresh: Cmd+Shift+R)
3. **Sign out and sign back in** from the admin panel
