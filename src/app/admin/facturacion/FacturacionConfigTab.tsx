"use client";

import { useEffect, useState, type FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { CreditCard, CheckCircle2, AlertCircle, History } from "lucide-react";
import {
  crearSetupIntent,
  guardarTarjetaDomiciliada,
  obtenerFacturacionAdmin,
  obtenerHistorialCobrosAdmin,
  type FacturacionNegocio,
  type CobroHistorial,
} from "@/lib/actions/facturacion";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner/Spinner";
import styles from "@/app/admin/configuracion/ModalConfiguracion.module.css";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// loadStripe() a nivel de módulo, no dentro del componente — si se llama en
// cada render, Stripe.js se vuelve a descargar y a inicializar cada vez.
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function FacturacionConfigTab() {
  const [facturacion, setFacturacion] = useState<FacturacionNegocio | null | undefined>(undefined);
  const [cobros, setCobros]           = useState<CobroHistorial[] | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cargando, setCargando]         = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    obtenerFacturacionAdmin().then((r) => {
      setFacturacion("error" in r ? null : r.facturacion);
    });
    obtenerHistorialCobrosAdmin().then((r) => {
      setCobros("error" in r ? [] : r.cobros);
    });
  }, []);

  async function handleIniciarDomiciliacion() {
    setCargando(true);
    setError(null);

    const result = await crearSetupIntent();
    setCargando(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setClientSecret(result.clientSecret);
  }

  function handleExito(actualizado: FacturacionNegocio) {
    setFacturacion(actualizado);
    setClientSecret(null);
  }

  if (facturacion === undefined) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-5)" }}>
        <Spinner />
      </div>
    );
  }

  if (!publishableKey) {
    return <div className={styles.errorBox}>⚠ Falta configurar NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY en el proyecto.</div>;
  }

  const yaDomiciliado   = facturacion?.tEstadoDomiciliacion === "domiciliado";
  const pausadoPorFalla = facturacion?.tEstadoDomiciliacion === "pausado_por_falla";

  return (
    <>
      <p className={styles.tabDesc}>
        Domicilia tu tarjeta para que el cobro de tu mensualidad con Kivi sea automático.
      </p>

      {pausadoPorFalla && (
        <div className={styles.errorBox}>
          <AlertCircle size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
          El último cobro no pasó y tu cuenta quedó pausada. Actualiza tu tarjeta para reactivarla.
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "var(--space-3) 0", borderBottom: "1px solid var(--border-light)",
      }}>
        <span style={{ fontSize: 13, color: "var(--gray)" }}>Estado de domiciliación</span>
        {yaDomiciliado ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-success)", fontWeight: 700, fontSize: 13 }}>
            <CheckCircle2 size={16} /> Domiciliada
          </span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gray)" }}>Sin domiciliar</span>
        )}
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "var(--space-3) 0", borderBottom: "1px solid var(--border-light)", marginBottom: "var(--space-4)",
      }}>
        <span style={{ fontSize: 13, color: "var(--gray)" }}>Pago mensual</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {facturacion?.eMontoMensual != null
            ? facturacion.eMontoMensual.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
            : "Aún no configurado por Kivi"}
        </span>
      </div>

      {error && <div className={styles.errorBox}>⚠ {error}</div>}

      {!clientSecret ? (
        <button
          className={styles.btnGuardar}
          onClick={handleIniciarDomiciliacion}
          disabled={cargando}
          style={{ flex: "none", width: "100%" }}
        >
          <CreditCard size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
          {cargando ? "Preparando..." : yaDomiciliado ? "Actualizar tarjeta" : "Domiciliar tarjeta"}
        </button>
      ) : (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <FormularioTarjeta onExito={handleExito} onCancelar={() => setClientSecret(null)} />
        </Elements>
      )}

      {cobros && cobros.length > 0 && (
        <div style={{ marginTop: "var(--space-5)" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)", display: "flex", alignItems: "center", gap: 6, marginBottom: "var(--space-3)" }}>
            <History size={14} /> Historial de cobros
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
            {cobros.map((c) => (
              <div
                key={c.eCodCobro}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                  padding: "8px 10px", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {c.eMonto.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--gray)" }}>
                    {new Date(c.fhCobro).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
                <Badge variante={c.tEstado === "succeeded" ? "activo" : "error"}>
                  {c.tEstado === "succeeded" ? "Pagado" : "Fallido"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function FormularioTarjeta({
  onExito,
  onCancelar,
}: {
  onExito:    (f: FacturacionNegocio) => void;
  onCancelar: () => void;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [enviando, setEnviando] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setEnviando(true);
    setError(null);

    // redirect: "if_required" — solo redirige si el banco de la tarjeta
    // exige un paso extra (3D Secure); si no, resuelve aquí mismo.
    const { error: stripeError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "No se pudo validar la tarjeta");
      setEnviando(false);
      return;
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method?.id;

    if (!paymentMethodId) {
      setError("Stripe no devolvió un método de pago válido");
      setEnviando(false);
      return;
    }

    const result = await guardarTarjetaDomiciliada(paymentMethodId);
    setEnviando(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    onExito(result.facturacion);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PaymentElement />
      {error && <div className={styles.errorBox}>⚠ {error}</div>}
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button
          type="button"
          onClick={onCancelar}
          className={styles.btnCancelar}
          disabled={enviando}
          style={{ flex: 1 }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className={styles.btnGuardar}
          disabled={!stripe || enviando}
          style={{ flex: 2 }}
        >
          {enviando ? "Guardando..." : "Guardar tarjeta"}
        </button>
      </div>
    </form>
  );
}