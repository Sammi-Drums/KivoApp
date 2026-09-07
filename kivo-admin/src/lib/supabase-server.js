import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient as createAdminClientBase } from '@supabase/supabase-js';

// Server client that reads the logged-in user's session from cookies.
// Use this in server components and API routes to know WHO is making the request.
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore,
            // middleware handles session refresh.
          }
        },
      },
    }
  );
}

// Admin client with the service role key — BYPASSES row-level security.
// Only use this in API routes for admin-only operations.
// NEVER expose the service role key to the browser.
export function createAdminClient() {
  return createAdminClientBase(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
