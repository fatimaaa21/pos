"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient }      from "@/lib/supabase/server";
import { revalidatePath }    from "next/cache";
import { mensajeError }      from "@/lib/utils/error";
import { stripe }            from "@/lib/stripe";

// ─────────────────────────────────────────────────────────────
// HELPERS DE AUTH
// facturacion_negocios/facturacion_cobros tienen RLS habilitado sin
// policies — el admin client bypasea RLS, así que estos checks en código
// son la única barrera real. Dos roles distintos tocan este archivo:
// "sistemas" fija el monto, "admin" domicilia su propia tarjeta. Nunca
// al revés — sistemas no debe poder tocar la tarjeta de nadie.
// ─────────────────────────────────────────────────────────────

async function esSistemas(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("tRolUser")
    .eq("eCodUser", user.id)
    .single();

  return perfil?.tRolUser === "sistemas";
}

async function getPerfilAdminActual(): Promise<{
  fkeCodCompany: string;
  email: string;
  nombreNegocio: string;
} | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany, tRolUser, tEmailUser")
    .eq("eCodUser", user.id)
    .single();

  if (!perfil?.fkeCodCompany || perfil.tRolUser !== "admin") return null;

  const { data: negocio } = await supabase
    .from("negocios")
    .select("tNameCompany")
    .eq("eCodCompany", perfil.fkeCodCompany)
    .single();

  return {
    fkeCodCompany: perfil.fkeCodCompany,
    email: perfil.tEmailUser,
    nombreNegocio: negocio?.tNameCompany ?? "Negocio",
  };
}

export interface FacturacionNegocio {
  fkeCodCompany:            string;
  eMontoMensual:            number;
  eMontoMensualPendiente:   number | null;
  tEstadoDomiciliacion:     "manual" | "domiciliado" | "pausado_por_falla";
  tCodStripeCustomer:       string | null;
}

interface FacturacionRow {
  fkeCodCompany:            string;
  eMontoMensual:            number;
  eMontoMensualPendiente?:  number | null;
  tEstadoDomiciliacion:     "manual" | "domiciliado" | "pausado_por_falla";
  tCodStripeCustomer?:      string | null;
}

function mapFacturacion(row: FacturacionRow): FacturacionNegocio {
  return {
    fkeCodCompany:          row.fkeCodCompany,
    eMontoMensual:          row.eMontoMensual,
    eMontoMensualPendiente: row.eMontoMensualPendiente ?? null,
    tEstadoDomiciliacion:   row.tEstadoDomiciliacion,
    tCodStripeCustomer:     row.tCodStripeCustomer ?? null,
  };
}

const NOMBRE_PRODUCTO_STRIPE = "Kivi — mensualidad";

// ─────────────────────────────────────────────────────────────
// Crea la suscripción en Stripe una vez que YA hay monto Y YA hay tarjeta
// domiciliada — se llama desde los dos lados (el que llega segundo activa).
// ─────────────────────────────────────────────────────────────

async function activarSuscripcion(
  adminClient: ReturnType<typeof createAdminClient>,
  fkeCodCompany: string,
  eMontoMensual: number,
  tCodStripeCustomer: string
): Promise<{ facturacion: FacturacionNegocio } | { error: string }> {
  try {
    const price = await stripe.prices.create({
      currency: "mxn",
      unit_amount: Math.round(eMontoMensual * 100),
      recurring: { interval: "month" },
      product_data: { name: NOMBRE_PRODUCTO_STRIPE },
    });

    // Sin default_payment_method explícito: Stripe usa el
    // invoice_settings.default_payment_method del customer, que ya
    // quedó fijado en guardarTarjetaDomiciliada.
    const subscription = await stripe.subscriptions.create({
      customer: tCodStripeCustomer,
      items: [{ price: price.id }],
    });

    const { data, error } = await adminClient
      .from("facturacion_negocios")
      .update({
        tCodStripeSubscription: subscription.id,
        tCodStripePriceActual:  price.id,
        tEstadoDomiciliacion:   "domiciliado",
        fhUpdateFacturacion:    new Date().toISOString(),
      })
      .eq("fkeCodCompany", fkeCodCompany)
      .select("*")
      .single();

    if (error) return { error: `Se creó la suscripción en Stripe pero falló al guardar en la base: ${error.message}` };

    return { facturacion: mapFacturacion(data) };
  } catch (e: unknown) {
    return { error: `Error de Stripe al activar la suscripción: ${mensajeError(e)}` };
  }
}

// ─────────────────────────────────────────────────────────────
// SISTEMAS — fijar/editar el monto mensual
// ─────────────────────────────────────────────────────────────

export async function guardarMontoMensual(
  fkeCodCompany: string,
  eMontoMensual: number
): Promise<{ facturacion: FacturacionNegocio } | { error: string }> {
  try {
    if (!(await esSistemas())) return { error: "No autorizado" };

    if (!fkeCodCompany) return { error: "Negocio no especificado" };
    if (!Number.isFinite(eMontoMensual) || eMontoMensual < 0) {
      return { error: "El monto debe ser un número mayor o igual a 0" };
    }

    const adminClient = createAdminClient();

    const { data: negocio, error: errorNegocio } = await adminClient
      .from("negocios")
      .select("eCodCompany")
      .eq("eCodCompany", fkeCodCompany)
      .single();

    if (errorNegocio || !negocio) return { error: "Negocio no encontrado" };

    const { data: actual } = await adminClient
      .from("facturacion_negocios")
      .select("*")
      .eq("fkeCodCompany", fkeCodCompany)
      .maybeSingle();

    // ── Caso 1: todavía no hay suscripción activa ──────────────────────────
    // (ni domiciliado, o domiciliado pero sistemas nunca había puesto monto)
    if (!actual?.tCodStripeSubscription) {
      const { data, error } = await adminClient
        .from("facturacion_negocios")
        .upsert(
          { fkeCodCompany, eMontoMensual, fhUpdateFacturacion: new Date().toISOString() },
          { onConflict: "fkeCodCompany" }
        )
        .select("*")
        .single();

      if (error) return { error: `Error al guardar: ${error.message}` };

      // Si el admin ya domicilió su tarjeta antes de que sistemas fijara el
      // monto, este es el momento en que se activa la suscripción de verdad.
      if (data.tCodStripeCustomer) {
        const activado = await activarSuscripcion(adminClient, fkeCodCompany, eMontoMensual, data.tCodStripeCustomer);
        revalidatePath("/sistemas/facturacion");
        return activado;
      }

      revalidatePath("/sistemas/facturacion");
      return { facturacion: mapFacturacion(data) };
    }

    // ── Caso 2: ya domiciliado con suscripción activa ──────────────────────
    // El cambio NO aplica de inmediato — se programa para el siguiente ciclo
    // vía Subscription Schedule. eMontoMensual sigue reflejando lo que se
    // cobra HOY; eMontoMensualPendiente es lo que entra al siguiente ciclo.
    const nuevoPrice = await stripe.prices.create({
      currency: "mxn",
      unit_amount: Math.round(eMontoMensual * 100),
      recurring: { interval: "month" },
      product_data: { name: NOMBRE_PRODUCTO_STRIPE },
    });

    let scheduleId = actual.tCodStripeScheduleId as string | null;

    if (!scheduleId) {
      const schedule = await stripe.subscriptionSchedules.create({
        from_subscription: actual.tCodStripeSubscription,
      });
      scheduleId = schedule.id;
    }

    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    const faseActual = schedule.phases[0];

    await stripe.subscriptionSchedules.update(scheduleId, {
      phases: [
        {
          items:      faseActual.items.map((i) => ({
            price: typeof i.price === "string" ? i.price : i.price.id,
          })),
          start_date: faseActual.start_date,
          end_date:   faseActual.end_date,
        },
        {
          // Sin end_date/iterations: corre indefinido hasta el próximo cambio.
          items: [{ price: nuevoPrice.id }],
        },
      ],
    });

    const { data, error } = await adminClient
      .from("facturacion_negocios")
      .update({
        tCodStripeScheduleId:     scheduleId,
        tCodStripePricePendiente: nuevoPrice.id,
        eMontoMensualPendiente:   eMontoMensual,
        fhUpdateFacturacion:      new Date().toISOString(),
      })
      .eq("fkeCodCompany", fkeCodCompany)
      .select("*")
      .single();

    if (error) return { error: `El cambio se programó en Stripe pero falló al guardar en la base: ${error.message}` };

    revalidatePath("/sistemas/facturacion");
    return { facturacion: mapFacturacion(data) };
  } catch (e: unknown) {
    return { error: `Error inesperado: ${mensajeError(e)}` };
  }
}

// ─────────────────────────────────────────────────────────────
// ADMIN — domiciliar su propia tarjeta
// ─────────────────────────────────────────────────────────────

/**
 * Crea (o reusa) el Customer de Stripe del negocio y devuelve un
 * SetupIntent listo para confirmar en el cliente con Stripe Elements.
 * El número de tarjeta nunca pasa por este servidor.
 */
export async function crearSetupIntent(): Promise<{ clientSecret: string } | { error: string }> {
  try {
    const perfil = await getPerfilAdminActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data: actual } = await adminClient
      .from("facturacion_negocios")
      .select("tCodStripeCustomer")
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .maybeSingle();

    let customerId = actual?.tCodStripeCustomer as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    perfil.email,
        name:     perfil.nombreNegocio,
        metadata: { fkeCodCompany: perfil.fkeCodCompany },
      });
      customerId = customer.id;

      const { error } = await adminClient
        .from("facturacion_negocios")
        .upsert(
          { fkeCodCompany: perfil.fkeCodCompany, tCodStripeCustomer: customerId },
          { onConflict: "fkeCodCompany" }
        );

      if (error) return { error: `Error al preparar la domiciliación: ${error.message}` };
    }

    const setupIntent = await stripe.setupIntents.create({
      customer:             customerId,
      payment_method_types: ["card"],
      usage:                "off_session",
    });

    if (!setupIntent.client_secret) return { error: "Stripe no devolvió client_secret" };

    return { clientSecret: setupIntent.client_secret };
  } catch (e: unknown) {
    return { error: `Error de Stripe: ${mensajeError(e)}` };
  }
}

/**
 * Se llama DESPUÉS de que el cliente confirmó el SetupIntent con
 * stripe.confirmSetup() y ya tiene un PaymentMethod válido y verificado.
 * Nunca recibe datos de tarjeta — solo el ID que Stripe ya generó.
 */
export async function guardarTarjetaDomiciliada(
  paymentMethodId: string
): Promise<{ facturacion: FacturacionNegocio } | { error: string }> {
  try {
    const perfil = await getPerfilAdminActual();
    if (!perfil) return { error: "No autorizado" };
    if (!paymentMethodId) return { error: "Método de pago no especificado" };

    const adminClient = createAdminClient();

    const { data: actual, error: errorLectura } = await adminClient
      .from("facturacion_negocios")
      .select("*")
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .maybeSingle();

    if (errorLectura || !actual?.tCodStripeCustomer) {
      return { error: "No se encontró el proceso de domiciliación — vuelve a intentar desde el inicio" };
    }

    // Confirmar que el payment_method de verdad pertenece a ESTE customer
    // antes de fijarlo como default — no confiar en el ID tal cual llega.
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (paymentMethod.customer !== actual.tCodStripeCustomer) {
      return { error: "No autorizado" };
    }

    await stripe.customers.update(actual.tCodStripeCustomer, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Si sistemas ya había fijado un monto, este es el momento de activar
    // la suscripción de verdad. Si no, queda domiciliado sin cobrar todavía
    // — activarSuscripcion() se dispara después, desde guardarMontoMensual.
    if (!actual.tCodStripeSubscription && actual.eMontoMensual > 0) {
      const activado = await activarSuscripcion(
        adminClient,
        perfil.fkeCodCompany,
        actual.eMontoMensual,
        actual.tCodStripeCustomer
      );
      revalidatePath("/admin/configuracion");
      return activado;
    }

    const { data, error } = await adminClient
      .from("facturacion_negocios")
      .update({ fhUpdateFacturacion: new Date().toISOString() })
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .select("*")
      .single();

    if (error) return { error: `Error al guardar: ${error.message}` };

    revalidatePath("/admin/configuracion");
    return { facturacion: mapFacturacion(data) };
  } catch (e: unknown) {
    return { error: `Error de Stripe: ${mensajeError(e)}` };
  }
}

/**
 * Estado de facturación del negocio del admin autenticado — para pintar la
 * pantalla de domiciliación (¿ya tiene tarjeta? ¿ya hay monto fijado?).
 */
export async function obtenerFacturacionAdmin(): Promise<
  { facturacion: FacturacionNegocio | null } | { error: string }
> {
  try {
    const perfil = await getPerfilAdminActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("facturacion_negocios")
      .select("*")
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .maybeSingle();

    if (error) return { error: error.message };

    return { facturacion: data ? mapFacturacion(data) : null };
  } catch (e: unknown) {
    return { error: `Error inesperado: ${mensajeError(e)}` };
  }
}