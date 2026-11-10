"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Only used for uploading files straight to Supabase Storage
 * (so big phone photos don't go through our server). Storage policies in the
 * database decide what each user may upload or read.
 */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
}
