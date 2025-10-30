// supabase/functions/shared/init.ts

import { createClient } from '@supabase/supabase-js';
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// This file centralizes the creation of Supabase clients for Edge Functions.
// It ensures that environment variables are checked once at startup, preventing
// runtime errors and providing clear configuration feedback.

// Fix for "Cannot find name 'Deno'" error in Supabase Edge Functions.
declare const Deno: any;

// Explicitly load environment variables from the .env file.
// This makes the function runtime more resilient, especially in local development.
// It searches for the .env file in the current directory and parent directories.
// The `export: true` option makes the variables available via Deno.env.get().
await load({ export: true });

// --- Environment Variable Validation ---
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) throw new Error('[Configuration Error] Environment variable SUPABASE_URL is not set.');
if (!supabaseAnonKey) throw new Error('[Configuration Error] Environment variable SUPABASE_ANON_KEY is not set.');
if (!serviceRoleKey) throw new Error('[Configuration Error] Environment variable SUPABASE_SERVICE_ROLE_KEY is not set.');

// --- Client Exports ---

/**
 * Supabase client for anonymous access.
 * Uses the public anon key and respects RLS policies.
 */
export const supabaseAnonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
    },
});

/**
 * Supabase client for admin-level access.
 * Uses the service role key to bypass Row Level Security (RLS).
 * IMPORTANT: This client should only be used in trusted server-side environments
 * for operations that require elevated privileges.
 */
export const supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
});
