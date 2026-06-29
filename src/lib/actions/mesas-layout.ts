// src/lib/actions/mesas-layout.ts
"use server";

import { createClient }       from "@/lib/supabase/server";
import { createAdminClient }  from "@/lib/supabase/admin";
import { revalidatePath }     from "next/cache";
import { getSucursalContext }  from "@/lib/utils/sucursal";

// ── Helper de auth ────────────────────────────────────────────────────────────

async function getPerfilActual() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("eCodUser, fkeCodCompany, tRolUser")
    .eq("eCodUser", user.id)
    .single();

  return perfil ? { ...perfil, uid: user.id } : null;
}

// ── Crear mesa con posición en el grid ───────────────────────────────────────

type CrearMesaLayoutInput = {
  tNombre:    string;
  t_shape:    "rect" | "circle";
  e_grid_col: number;
  e_grid_row: number;
  e_grid_w:   number;
  e_grid_h:   number;
};

export async function crearMesaLayout(
  data: CrearMesaLayoutInput
): Promise<{ error: string } | { eCodMesa: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const ctx = await getSucursalContext();
  if (!ctx.fkeCodSucursal) return { error: "Selecciona una sucursal antes de crear mesas" };

  const adminClient = createAdminClient();

  const { data: nueva, error } = await adminClient
    .from("mesas")
    .insert({
      fkeCodCompany:  perfil.fkeCodCompany,
      fkeCodSucursal: ctx.fkeCodSucursal,
      tNombre:        data.tNombre.trim(),
      t_shape:        data.t_shape,
      e_grid_col:     data.e_grid_col,
      e_grid_row:     data.e_grid_row,
      e_grid_w:       data.e_grid_w,
      e_grid_h:       data.e_grid_h,
      bStateMesa:     true,
      fhCreateMesa:   new Date().toISOString(),
    })
    .select("eCodMesa")
    .single();

  if (error) return { error: error.message };
  return { eCodMesa: nueva.eCodMesa };
}

// ── Guardar posiciones y nombres ──────────────────────────────────────────────
// Usa UPDATE individual por mesa (no upsert) para evitar el path INSERT
// que falla al no llevar fkeCodCompany (NOT NULL) en el payload.
// Todas las mesas ya existen en DB — solo actualizamos sus posiciones.

type PosicionMesa = {
  eCodMesa:   string;
  tNombre:    string;
  e_grid_col: number;
  e_grid_row: number;
  e_grid_w:   number;
  e_grid_h:   number;
};

export async function guardarLayoutMesas(
  mesas: PosicionMesa[],
  pathRevalidar: string
): Promise<{ error: string } | { ok: true }> {
  if (mesas.length === 0) return { ok: true };

  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  // Paralelo: un UPDATE por mesa, filtrado por fkeCodCompany como guarda de seguridad
  const results = await Promise.all(
    mesas.map((m) =>
      adminClient
        .from("mesas")
        .update({
          tNombre:    m.tNombre,
          e_grid_col: m.e_grid_col,
          e_grid_row: m.e_grid_row,
          e_grid_w:   m.e_grid_w,
          e_grid_h:   m.e_grid_h,
        })
        .eq("eCodMesa", m.eCodMesa)
        .eq("fkeCodCompany", perfil.fkeCodCompany)
    )
  );

  const primerError = results.find((r) => r.error);
  if (primerError?.error) return { error: primerError.error.message };

  revalidatePath(pathRevalidar);
  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ── Eliminar mesa ─────────────────────────────────────────────────────────────

export async function eliminarMesaLayout(
  eCodMesa: string,
  pathRevalidar: string
): Promise<{ error: string } | { ok: true }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  const { data: mesa } = await adminClient
    .from("mesas")
    .select("fkeCodCompany")
    .eq("eCodMesa", eCodMesa)
    .single();

  if (!mesa || mesa.fkeCodCompany !== perfil.fkeCodCompany) {
    return { error: "Sin acceso" };
  }

  const { data: ordenAbierta } = await adminClient
    .from("ordenes_mesa")
    .select("eCodOrden")
    .eq("fkeCodMesa", eCodMesa)
    .eq("tEstado", "abierta")
    .maybeSingle();

  if (ordenAbierta) {
    return { error: "No puedes eliminar una mesa con una orden abierta" };
  }

  const { error } = await adminClient
    .from("mesas")
    .delete()
    .eq("eCodMesa", eCodMesa);

  if (error) return { error: error.message };

  revalidatePath(pathRevalidar);
  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ── Toggle bStateMesa ─────────────────────────────────────────────────────────

export async function toggleMesaLayout(
  eCodMesa: string,
  bActiva: boolean
): Promise<{ error: string } | { ok: true }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("mesas")
    .update({ bStateMesa: bActiva })
    .eq("eCodMesa", eCodMesa)
    .eq("fkeCodCompany", perfil.fkeCodCompany);

  if (error) return { error: error.message };
  return { ok: true };
}

// ── Abrir mesa desde el editor de layout ─────────────────────────────────────
// Misma lógica que abrirOrdenMesa del empleado, accesible para el admin.

export async function abrirMesaLayout(
  eCodMesa: string
): Promise<{ error: string } | { eCodOrden: string; fhAbierta: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  const { data: mesa } = await adminClient
    .from("mesas")
    .select("fkeCodCompany, fkeCodSucursal, bStateMesa")
    .eq("eCodMesa", eCodMesa)
    .single();

  if (!mesa || mesa.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (!mesa.bStateMesa) return { error: "Activa la mesa antes de abrirla" };

  const { data: yaAbierta } = await adminClient
    .from("ordenes_mesa")
    .select("eCodOrden")
    .eq("fkeCodMesa", eCodMesa)
    .eq("tEstado", "abierta")
    .maybeSingle();

  if (yaAbierta) return { error: "La mesa ya tiene una orden abierta" };

  const ctx       = await getSucursalContext();
  const fhAbierta = new Date().toISOString();

  const { data: orden, error } = await adminClient
    .from("ordenes_mesa")
    .insert({
      fkeCodMesa:     eCodMesa,
      fkeCodCompany:  perfil.fkeCodCompany,
      fkeCodSucursal: ctx.fkeCodSucursal ?? mesa.fkeCodSucursal,
      fkeCodUser:     perfil.uid,
      tEstado:        "abierta",
      fhAbierta,
    })
    .select("eCodOrden")
    .single();

  if (error) return { error: error.message };
  return { eCodOrden: orden.eCodOrden, fhAbierta };
}

// ── Cancelar mesa desde el editor de layout ──────────────────────────────────
// Cierra la orden SIN generar venta ni cobrar — solo para mesas abiertas
// por error. El cobro real siempre ocurre desde el menú POS del empleado.

export async function cancelarMesaLayout(
  eCodOrden:     string,
  pathRevalidar: string
): Promise<{ error: string } | { ok: true }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  // Verificar propiedad
  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("fkeCodCompany, tEstado")
    .eq("eCodOrden", eCodOrden)
    .single();

  if (!orden || orden.fkeCodCompany !== perfil.fkeCodCompany)
    return { error: "Sin acceso" };
  if (orden.tEstado !== "abierta")
    return { error: "La orden ya no está abierta" };

  const { error } = await adminClient
    .from("ordenes_mesa")
    .update({
      tEstado:   "cancelada",
      fhCerrada: new Date().toISOString(),
    })
    .eq("eCodOrden", eCodOrden);

  if (error) return { error: error.message };

  revalidatePath(pathRevalidar);
  revalidatePath("/empleado/mesas");
  return { ok: true };
}