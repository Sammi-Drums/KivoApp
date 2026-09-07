import { createBrowserClient } from '@supabase/ssr';

// This client runs in the browser (client components).
// It reads the public URL + anon key from environment variables.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// A ready-to-use singleton for convenience in client components
export const supabase = createClient();
