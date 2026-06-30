// src/app/cocina/[token]/page.tsx
// Server Component: valida que el token existe antes de renderizar.
// Sin autenticación de usuario — solo token de sucursal.

import { createAdminClient } from "@/lib/supabase/admin";
import { KitchenDisplay }    from "./KitchenDisplay";

export default async function CocinaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const adminClient = createAdminClient();
  const { data: sucursal } = await adminClient
    .from("sucursales")
    .select("eCodSucursal, tNombre")
    .eq("tTokenCocina", token)
    .eq("bStateSucursal", true)
    .single();

  if (!sucursal) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          color: "#888",
          fontFamily: "sans-serif",
          fontSize: 15,
        }}
      >
        Token inválido o sucursal inactiva.
      </div>
    );
  }

  return (
    <KitchenDisplay
      token={token}
      tNombreSucursal={sucursal.tNombre}
    />
  );
}