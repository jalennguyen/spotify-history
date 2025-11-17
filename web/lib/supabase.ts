import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

// Create client with default public schema
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to get a client scoped to analytics schema
// Using .schema() method as per: https://supabase.com/docs/guides/api/using-custom-schemas
export const analyticsSupabase = supabase.schema("analytics");

