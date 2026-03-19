import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"

function makeCookieHandlers(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return {
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      } catch {
        // Ignore errors thrown from Server Components (read-only cookie store)
      }
    },
  }
}

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: makeCookieHandlers(cookieStore) }
  )
}

/**
 * Server-side Supabase client using the service role key for privileged writes.
 * Falls back to anon key if service role key is not set.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: makeCookieHandlers(cookieStore) }
  )
}
