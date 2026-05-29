"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath }    from "next/cache";
import type { CorteCaja }    from "@/types";

// ─────────────────────────────────────────────────────────────
// EMPLEADO: Iniciar turno
// ─────────────────────────────────────────────────────────────
export async function iniciarTurno(formData: FormData) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    // 1. Verificar sesión
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    // 2. Obtener negocio del empleado
    const { data: perfil, error: perfilError } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (perfilError || !perfil?.fkeCodCompany) {
      return { error: "No se encontró el negocio del empleado" };
    }

    // 3. Verificar que no haya un turno ya abierto
    const { data: turnoAbierto } = await adminClient
      .from("cortes_caja")
      .select("eCodCorte")
      .eq("fkeCodUser", user.id)
      .eq("bStateCorte", "abierto")
      .maybeSingle();

    if (turnoAbierto) {
      return { error: "Ya tienes un turno abierto" };
    }

    // 4. Parsear datos del form
    const eFondoInicial = parseFloat(formData.get("eFondoInicial") as string);
    const tNombreTurno  = (formData.get("tNombreTurno") as string) || null;

    if (isNaN(eFondoInicial) || eFondoInicial < 0) {
      return { error: "Fondo inicial inválido" };
    }

    // 5. Crear el corte en estado 'abierto'
    const ahora = new Date().toISOString();
    const { data: corte, error: corteError } = await adminClient
      .from("cortes_caja")
      .insert({
        fkeCodUser:    user.id,
        fkeCodCompany: perfil.fkeCodCompany,
        tNombreTurno,
        eFondoInicial,
        bStateCorte:  "abierto",
        fhInicioTurno: ahora,
        fhCreateCorte: ahora,
        fhUpdateCorte: ahora,
      })
      .select("eCodCorte, fhInicioTurno, eFondoInicial, bStateCorte")
      .single();

    if (corteError || !corte) {
      return { error: `Error al iniciar turno: ${corteError?.message}` };
    }

    revalidatePath("/empleado/corte");
    return { corte: corte as CorteCaja };

  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ─────────────────────────────────────────────────────────────
// EMPLEADO: Cerrar turno (enviar corte)
// ─────────────────────────────────────────────────────────────
export async function cerrarTurno(formData: FormData) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    // 1. Verificar sesión
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    // 2. Buscar el turno abierto del empleado
    const { data: corte, error: corteError } = await adminClient
      .from("cortes_caja")
      .select("eCodCorte, eFondoInicial, fhInicioTurno")
      .eq("fkeCodUser", user.id)
      .eq("bStateCorte", "abierto")
      .single();

    if (corteError || !corte) {
      return { error: "No se encontró un turno abierto" };
    }

    // 3. Calcular totales desde ventas del turno
    const { data: ventas, error: ventasError } = await adminClient
      .from("ventas")
      .select("eTotal, fkeMetodoPago")
      .eq("fkeCodUser", user.id)
      .gte("fhCreateVenta", corte.fhInicioTurno);

    if (ventasError) {
      return { error: `Error al calcular ventas: ${ventasError.message}` };
    }

    const eTotalEfectivo      = (ventas ?? [])
    .filter(v => v.fkeMetodoPago === "efectivo")
    .reduce((acc, v) => acc + v.eTotal, 0);

    const eTotalTarjeta       = (ventas ?? [])
    .filter(v => v.fkeMetodoPago === "tarjeta")
    .reduce((acc, v) => acc + v.eTotal, 0);

    const eTotalTransferencia = (ventas ?? [])
    .filter(v => v.fkeMetodoPago === "transferencia")
    .reduce((acc, v) => acc + v.eTotal, 0);

    console.log("ventas sample:", JSON.stringify(ventas?.[0]));


    const eTotalVentas        = eTotalEfectivo + eTotalTarjeta + eTotalTransferencia;
    const eEfectivoEsperado   = corte.eFondoInicial + eTotalEfectivo;

    // 4. Efectivo físico contado por el empleado
    const eEfectivoContado = parseFloat(formData.get("eEfectivoContado") as string);
    if (isNaN(eEfectivoContado) || eEfectivoContado < 0) {
      return { error: "Monto de efectivo contado inválido" };
    }

    const eDiferencia = eEfectivoContado - eEfectivoEsperado;
    const ahora       = new Date().toISOString();

    // 5. Actualizar el corte a estado 'pendiente'
    const { data: corteActualizado, error: updateError } = await adminClient
      .from("cortes_caja")
      .update({
        eEfectivoContado,
        eTotalEfectivo,
        eTotalTarjeta,
        eTotalTransferencia,
        eTotalVentas,
        eEfectivoEsperado,
        eDiferencia,
        bStateCorte:  "pendiente",
        fhCierreTurno: ahora,
        fhUpdateCorte: ahora,
      })
      .eq("eCodCorte", corte.eCodCorte)
      .select()
      .single();

    if (updateError || !corteActualizado) {
      return { error: `Error al cerrar turno: ${updateError?.message}` };
    }

    revalidatePath("/empleado/corte");
    revalidatePath("/admin/cortes");
    return { corte: corteActualizado as CorteCaja };

  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN: Aprobar o marcar diferencia en un corte
// ─────────────────────────────────────────────────────────────
export async function revisarCorte(formData: FormData) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    // 1. Verificar sesión y rol admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("tRolUser, fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (perfil?.tRolUser !== "admin") {
      return { error: "Acceso no autorizado" };
    }

    // 2. Parsear datos
    const eCodCorte    = formData.get("eCodCorte")    as string;
    const bStateCorte = formData.get("bStateCorte") as "aprobado" | "diferencia";
    const tNotaAdmin   = (formData.get("tNotaAdmin")  as string) || null;

    if (!["aprobado", "diferencia"].includes(bStateCorte)) {
      return { error: "Estado inválido" };
    }

    // 3. Verificar que el corte pertenece al negocio del admin
    const { data: corte } = await adminClient
      .from("cortes_caja")
      .select("eCodCorte, bStateCorte, fkeCodCompany")
      .eq("eCodCorte", eCodCorte)
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .single();

    if (!corte) {
      return { error: "Corte no encontrado" };
    }

    if (corte.bStateCorte !== "pendiente") {
      return { error: "Solo se pueden revisar cortes en estado pendiente" };
    }

    // 4. Actualizar
    const { data: corteActualizado, error: updateError } = await adminClient
      .from("cortes_caja")
      .update({
        bStateCorte,
        tNotaAdmin,
        fkeCodAdmin:   user.id,
        fhUpdateCorte: new Date().toISOString(),
      })
      .eq("eCodCorte", eCodCorte)
      .select()
      .single();

    if (updateError || !corteActualizado) {
      return { error: `Error al revisar corte: ${updateError?.message}` };
    }

    revalidatePath("/admin/cortes");
    return { corte: corteActualizado as CorteCaja };

  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ─────────────────────────────────────────────────────────────
// UTIL: Obtener turno abierto del empleado actual
// ─────────────────────────────────────────────────────────────
export async function getTurnoAbierto() {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { corte: null };

    const { data: corte } = await adminClient
      .from("cortes_caja")
      .select("*")
      .eq("fkeCodUser", user.id)
      .eq("bStateCorte", "abierto")
      .maybeSingle();

    return { corte: (corte ?? null) as CorteCaja | null };

  } catch {
    return { corte: null };
  }
}