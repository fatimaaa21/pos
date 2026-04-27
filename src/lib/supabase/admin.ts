import { createClient } from "@supabase/supabase-js";

// Cliente con service_role para operaciones admin (crear/eliminar usuarios en Auth)
// NUNCA expongas esta clave en el cliente
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}