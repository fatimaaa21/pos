import { createClient }       from "@/lib/supabase/server";
import { createAdminClient }  from "@/lib/supabase/admin";
import { redirect }           from "next/navigation";
import { getSucursalContext }  from "@/lib/utils/sucursal";
import { LayoutEditorMesas }    from "./LayoutEditorMesas";
import type { MesaEditorData } from "./mesas-editor-types";
import type { ConceptoBillar } from "@/types";

export default async function AdminMesasPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany, tRolUser")
    .eq("eCodUser", user.id)
    .single();

  if (!perfil || perfil.tRolUser !== "admin") redirect("/admin/dashboard");

  // ── Módulo activo ──────────────────────────────────────────────────────────
  const { data: modulo } = await adminClient
    .from("modulos_tenant")
    .select("bStateModulo")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .eq("tModulo", "mesas")
    .single();

  if (!modulo?.bStateModulo) redirect("/admin/dashboard");

  // ── Mesas de la sucursal activa ────────────────────────────────────────────
  const ctx = await getSucursalContext();

  const q = adminClient
    .from("mesas")
    .select("eCodMesa, tNombre, bStateMesa, e_grid_col, e_grid_row, e_grid_w, e_grid_h, t_shape, fkeCodConcepto")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .order("tNombre");

  if (ctx.fkeCodSucursal) q.eq("fkeCodSucursal", ctx.fkeCodSucursal);

  // Negocio (tipo de negocio y métodos de pago)
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("tipo_negocio, metodosPago")
    .eq("eCodCompany", perfil.fkeCodCompany)
    .single();

  const tipo_negocio = (negocio?.tipo_negocio ?? "general") as "general" | "impresion" | "billar";

  // Conceptos de tarifa (solo aplica a negocios billar)
  let conceptos: ConceptoBillar[] = [];
  if (tipo_negocio === "billar") {
    const { data: conceptosData } = await adminClient
      .from("conceptos_billar")
      .select("*")
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .eq("bActivo", true)
      .order("fhCreate");
    conceptos = conceptosData ?? [];
  }

  // Métodos de pago activos
  const idsMetodos: string[] = negocio?.metodosPago ?? [];
  let metodosPago: { eCodPay: string; tNamePay: string }[] = [];
  if (idsMetodos.length > 0) {
    const { data: metodos } = await adminClient
      .from("metodos_pago")
      .select("eCodPay, tNamePay")
      .in("eCodPay", idsMetodos)
      .eq("bStatePay", true);
    metodosPago = (metodos as { eCodPay: string; tNamePay: string }[]) ?? [];
  }

  // Órdenes abiertas para saber qué mesas ya están en uso
  const [{ data: mesas }, { data: ordenesAbiertas }] = await Promise.all([
    q,
    adminClient
      .from("ordenes_mesa")
      .select("eCodOrden, fkeCodMesa, fhAbierta")
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .eq("tEstado", "abierta"),
  ]);

  const ordenPorMesa = new Map(
    (ordenesAbiertas ?? []).map(o => [o.fkeCodMesa, { eCodOrden: o.eCodOrden, fhAbierta: o.fhAbierta }])
  );

  const mesasEditor: MesaEditorData[] = (mesas ?? []).map((m) => ({
    eCodMesa:    m.eCodMesa,
    tNombre:     m.tNombre,
    e_grid_col:  m.e_grid_col ?? 0,
    e_grid_row:  m.e_grid_row ?? 0,
    e_grid_w:    m.e_grid_w   ?? 1,
    e_grid_h:    m.e_grid_h   ?? 1,
    t_shape:     (m.t_shape   ?? "rect") as "rect" | "circle",
    bStateMesa:  m.bStateMesa ?? true,
    fkeCodConcepto: m.fkeCodConcepto ?? null,
    ordenAbierta: ordenPorMesa.get(m.eCodMesa) ?? null,
  }));

  // ── Layout ─────────────────────────────────────────────────────────────────
  // El header ocupa ~80px (título + descripción), el resto al editor.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--dark)", margin: 0 }}>
            Mesas
          </h1>
          <p style={{ fontSize: 13, color: "var(--gray)", margin: "var(--space-1) 0 0" }}>
            Arrastra para organizar · Ajusta tamaño con los controles · Guarda cuando termines
          </p>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <LayoutEditorMesas
          mesasIniciales={mesasEditor}
          pathRevalidar="/admin/mesas"
          tipo_negocio={tipo_negocio}
          conceptos={conceptos}
        />
      </div>
    </div>
  );
}