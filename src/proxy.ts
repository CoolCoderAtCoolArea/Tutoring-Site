import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

/**
 * Runs before every page:
 *  1. Picks the language (next-intl).
 *  2. On dashboard pages, refreshes the Supabase login session cookie.
 * Public pages skip step 2 so they stay fast and cacheable.
 */
export default async function proxy(request: NextRequest) {
  const response = intl(request);
  const path = request.nextUrl.pathname;
  const needsSession = /^\/(?:[a-z]{2}\/)?(dashboard|login|auth)(\/|$)/.test(path);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!needsSession || !url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Touching getUser() refreshes an expiring session and writes the new cookie.
  await supabase.auth.getUser();
  return response instanceof NextResponse ? response : NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals, and files with an extension (images, robots.txt, ...).
  matcher: ["/((?!api|_next|_vercel|auth/callback|.*\\..*).*)"],
};
