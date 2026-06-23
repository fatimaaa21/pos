"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath }    from "next/cache";
import { resolverSucursalVenta } from "@/lib/utils/sucursal";
import type { CorteCaja }    from "@/types";

export async function iniciarTurno(formData: FormData) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    // Resuelve sucursal: fija para empleado, por cookie (o única) para admin.
    const ctx = await resolverSucursalVenta();
    if ("error" in ctx) return ctx;

    const { fkeCodCompany, fkeCodSucursal } = ctx;

    const { data: turnoAbierto } = await adminClient
      .from("cortes_caja")
      .select("eCodCorte")
      .eq("fkeCodUser", user.id)
      .eq("bStateCorte", "abierto")
      .maybeSingle();

    if (turnoAbierto) return { error: "Ya tienes un turno abierto" };

    const eFondoInicial = parseFloat(formData.get("eFondoInicial") as string);
    const tNombreTurno  = (formData.get("tNombreTurno") as string) || null;

    if (isNaN(eFondoInicial) || eFondoInicial < 0) {
      return { error: "Fondo inicial inválido" };
    }

    const ahora = new Date().toISOString();
    const { data: corte, error: corteError } = await adminClient
      .from("cortes_caja")
      .insert({
        fkeCodUser:      user.id,
        fkeCodCompany,
        fkeCodSucursal,
        tNombreTurno,
        eFondoInicial,
        bStateCorte:     "abierto",
        fhInicioTurno:   ahora,
        fhCreateCorte:   ahora,
        fhUpdateCorte:   ahora,
      })
      .select("eCodCorte, fhInicioTurno, eFondoInicial, bStateCorte")
      .single();

    if (corteError || !corte) {
      return { error: `Error al iniciar turno: ${corteError?.message}` };
    }

    revalidatePath("/empleado/corte");
    revalidatePath("/admin/vender");
    return { corte: corte as CorteCaja };

  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function cerrarTurno(formData: FormData) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    const { data: corte, error: corteError } = await adminClient
      .from("cortes_caja")
      .select("eCodCorte, eFondoInicial, fhInicioTurno, fkeCodSucursal")
      .eq("fkeCodUser", user.id)
      .eq("bStateCorte", "abierto")
      .single();

    if (corteError || !corte) {
      return { error: "No se encontró un turno abierto" };
    }

    // Ventas del turno — filtradas por sucursal
    const { data: ventas, error: ventasError } = await adminClient
      .from("ventas")
      .select("eTotal, fkeMetodoPago")
      .eq("fkeCodUser", user.id)
      .eq("fkeCodSucursal", corte.fkeCodSucursal)  // ← nuevo
      .eq("bCancelada", false)
      .gte("fhCreateVenta", corte.fhInicioTurno);

    if (ventasError) {
      return { error: `Error al calcular ventas: ${ventasError.message}` };
    }

    const eTotalVentas = (ventas ?? []).reduce((acc, v) => acc + v.eTotal, 0);

    let eTotalEfectivo      = 0;
    let eTotalTarjeta       = 0;
    let eTotalTransferencia = 0;

    if (ventas && ventas.length > 0) {
      const metodosIds = [...new Set(ventas.map((v) => v.fkeMetodoPago))];

      const { data: metodosInfo } = await adminClient
        .from("metodos_pago")
        .select("eCodPay, tNamePay")
        .in("eCodPay", metodosIds);

      const metodosMap = new Map(
        (metodosInfo ?? []).map((m) => [m.eCodPay, m.tNamePay.toLowerCase()])
      );

      const esEfectivo = (id: string) => (metodosMap.get(id) ?? "").includes("efectivo");
      const esTarjeta  = (id: string) => (metodosMap.get(id) ?? "").includes("tarjeta");

      eTotalEfectivo = ventas
        .filter((v) => esEfectivo(v.fkeMetodoPago))
        .reduce((acc, v) => acc + v.eTotal, 0);

      eTotalTarjeta = ventas
        .filter((v) => esTarjeta(v.fkeMetodoPago))
        .reduce((acc, v) => acc + v.eTotal, 0);

      eTotalTransferencia = ventas
        .filter((v) => !esEfectivo(v.fkeMetodoPago) && !esTarjeta(v.fkeMetodoPago))
        .reduce((acc, v) => acc + v.eTotal, 0);
    }

    const eEfectivoEsperado = corte.eFondoInicial + eTotalEfectivo;
    const eEfectivoContado  = parseFloat(formData.get("eEfectivoContado") as string);

    if (isNaN(eEfectivoContado) || eEfectivoContado < 0) {
      return { error: "Monto de efectivo contado inválido" };
    }

    const eDiferencia = eEfectivoContado - eEfectivoEsperado;
    const ahora       = new Date().toISOString();

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
        bStateCorte:   "pendiente",
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
    revalidatePath("/admin/vender");
    return { corte: corteActualizado as CorteCaja };

  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function revisarCorte(formData: FormData) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("tRolUser, fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (perfil?.tRolUser !== "admin") return { error: "Acceso no autorizado" };

    const eCodCorte   = formData.get("eCodCorte")    as string;
    const bStateCorte = formData.get("bStateCorte")  as "aprobado" | "diferencia";
    const tNotaAdmin  = (formData.get("tNotaAdmin")  as string) || null;

    if (!["aprobado", "diferencia"].includes(bStateCorte)) {
      return { error: "Estado inválido" };
    }

    const { data: corte } = await adminClient
      .from("cortes_caja")
      .select("eCodCorte, bStateCorte, fkeCodCompany")
      .eq("eCodCorte", eCodCorte)
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .single();

    if (!corte) return { error: "Corte no encontrado" };
    if (corte.bStateCorte !== "pendiente") {
      return { error: "Solo se pueden revisar cortes en estado pendiente" };
    }

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