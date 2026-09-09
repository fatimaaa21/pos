import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Este endpoint SOLO confía en eventos con firma válida de Stripe — nunca en
// el payload a ciegas. STRIPE_WEBHOOK_SECRET lo da Stripe al registrar esta
// URL en Developers → Webhooks (o `stripe listen` en local).

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Falta STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 500 });
  }

  const firma = req.headers.get("stripe-signature");
  if (!firma) {
    return NextResponse.json({ error: "Falta firma" }, { status: 400 });
  }

  // Raw body exacto — constructEvent falla si se le pasa algo ya parseado
  // a JSON y reserializado, porque la firma se calculó sobre los bytes tal
  // cual los mandó Stripe.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, firma, webhookSecret);
  } catch (e) {
    console.error("Firma de webhook inválida:", e);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  try {
    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subDetails = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof subDetails === "string" ? subDetails : subDetails?.id ?? null;
        if (!subscriptionId) break;

        const { data: facturacion } = await adminClient
          .from("facturacion_negocios")
          .select("fkeCodCompany, tEstadoDomiciliacion")
          .eq("tCodStripeSubscription", subscriptionId)
          .maybeSingle();

        if (!facturacion) break;

        await adminClient.from("facturacion_cobros").upsert(
          {
            fkeCodCompany:      facturacion.fkeCodCompany,
            tCodStripeInvoice:  invoice.id,
            eMonto:             invoice.amount_paid / 100,
            tEstado:            "succeeded",
          },
          { onConflict: "tCodStripeInvoice" }
        );

        // Si venía de una pausa por falla, el cobro exitoso lo reactiva.
        if (facturacion.tEstadoDomiciliacion === "pausado_por_falla") {
          await adminClient
            .from("facturacion_negocios")
            .update({ tEstadoDomiciliacion: "domiciliado" })
            .eq("fkeCodCompany", facturacion.fkeCodCompany);

          await adminClient
            .from("negocios")
            .update({ bStateCompany: "activo" })
            .eq("eCodCompany", facturacion.fkeCodCompany);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subDetails = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof subDetails === "string" ? subDetails : subDetails?.id ?? null;
        if (!subscriptionId) break;

        const { data: facturacion } = await adminClient
          .from("facturacion_negocios")
          .select("fkeCodCompany")
          .eq("tCodStripeSubscription", subscriptionId)
          .maybeSingle();

        if (!facturacion) break;

        await adminClient.from("facturacion_cobros").upsert(
          {
            fkeCodCompany:      facturacion.fkeCodCompany,
            tCodStripeInvoice:  invoice.id,
            eMonto:             invoice.amount_due / 100,
            tEstado:            "failed",
            tMotivoFallo:       "Cargo rechazado — ver detalles en el dashboard de Stripe",
          },
          { onConflict: "tCodStripeInvoice" }
        );

        // next_payment_attempt === null significa que Stripe ya agotó los
        // reintentos configurados (Smart Retries) y no va a volver a
        // intentar este invoice — ahí es cuando pausamos, no en el primer
        // fallo. El margen de gracia lo controla el calendario de
        // reintentos configurado en el dashboard de Stripe, no este código.
        if (invoice.next_payment_attempt === null) {
          await adminClient
            .from("facturacion_negocios")
            .update({ tEstadoDomiciliacion: "pausado_por_falla" })
            .eq("fkeCodCompany", facturacion.fkeCodCompany);

          await adminClient
            .from("negocios")
            .update({ bStateCompany: "pausado" })
            .eq("eCodCompany", facturacion.fkeCodCompany);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const { data: facturacion } = await adminClient
          .from("facturacion_negocios")
          .select("fkeCodCompany, tCodStripePricePendiente, eMontoMensualPendiente, eDiaCobroPendiente")
          .eq("tCodStripeSubscription", subscription.id)
          .maybeSingle();

        if (!facturacion) break;

        // Si Stripe canceló la suscripción del todo (acción final de dunning
        // configurada como "cancelar" en vez de "dejar sin cobrar"), pausar
        // igual que en el caso de reintentos agotados.
        if (subscription.status === "canceled") {
          await adminClient
            .from("facturacion_negocios")
            .update({ tEstadoDomiciliacion: "pausado_por_falla" })
            .eq("fkeCodCompany", facturacion.fkeCodCompany);

          await adminClient
            .from("negocios")
            .update({ bStateCompany: "pausado" })
            .eq("eCodCompany", facturacion.fkeCodCompany);
          break;
        }

        // ¿El Subscription Schedule ya aplicó el precio pendiente? Se nota
        // porque el price activo de la suscripción ya coincide con el que
        // teníamos guardado como "pendiente para el siguiente ciclo".
        const precioActualId = subscription.items.data[0]?.price?.id;
        if (
          facturacion.tCodStripePricePendiente &&
          precioActualId === facturacion.tCodStripePricePendiente
        ) {
          await adminClient
            .from("facturacion_negocios")
            .update({
              eMontoMensual:            facturacion.eMontoMensualPendiente,
              eMontoMensualPendiente:   null,
              // Si no hubo cambio de día en este schedule, eDiaCobroPendiente
              // ya era null desde que se programó — no promovemos un valor
              // que nunca se puso, para no borrar el día actual por error.
              ...(facturacion.eDiaCobroPendiente != null
                ? { eDiaCobro: facturacion.eDiaCobroPendiente, eDiaCobroPendiente: null }
                : {}),
              tCodStripePriceActual:    facturacion.tCodStripePricePendiente,
              tCodStripePricePendiente: null,
              tCodStripeScheduleId:     null,
            })
            .eq("fkeCodCompany", facturacion.fkeCodCompany);
        }
        break;
      }

      default:
        // Cualquier otro evento se ignora a propósito — no reaccionamos a
        // eventos que no manejamos explícitamente.
        break;
    }
  } catch (e) {
    // Nunca dejar que un error de nuestro lado le devuelva un error a
    // Stripe si ya procesamos lo esencial — pero sí lo logueamos, porque
    // Stripe reintentará este webhook y podríamos duplicar trabajo si el
    // error fue después de escrituras parciales.
    console.error(`Error procesando webhook ${event.type}:`, e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}