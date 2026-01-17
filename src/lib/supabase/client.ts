"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "~/env";

/**
 * Browser-side Supabase client
 * Uses the anon key - respects Row Level Security (RLS)
 * Use this for:
 * - Client components
 * - Realtime subscriptions
 * - User-facing operations
 */
export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
