import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Route-handler scoped Supabase client bound to request cookies/session.
export function createClient() {
  return createRouteHandlerClient({ cookies });
}
