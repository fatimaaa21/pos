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
    .select("eCodSucursal, tNombre, fkeCodCompany")
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

  // El token por sí solo no bastaba — antes esta pantalla se podía seguir
  // usando aunque el negocio tuviera el módulo "cocina" desactivado desde
  // Sistemas → Negocios. Se valida aquí, directo en el punto de entrada,
  // en vez de solo esconder el botón de copiar URL en el admin (eso no
  // bloqueaba a nadie que ya tuviera la URL guardada de antes).
  const { data: modulo } = await adminClient
    .from("modulos_tenant")
    .select("bStateModulo")
    .eq("fkeCodCompany", sucursal.fkeCodCompany)
    .eq("tModulo", "cocina")
    .maybeSingle();

  if (modulo?.bStateModulo !== true) {
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
        El módulo de cocina no está activo para este negocio.
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