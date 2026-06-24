"use client";

import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";
import * as Icons from "lucide-react";
import { guardarConfigNegocio, type ConfigNegocio } from "@/lib/actions/configuracion";
import { guardarMetodosNegocio, type MetodoPagoGlobal } from "@/lib/actions/metodos-pago";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";
import styles from "./ModalConfiguracion.module.css";
import { Spinner } from "@/components/ui/Spinner/Spinner";

// ── Opciones ─────────────────────────────────────────────────────────────────

const MONEDAS = [
  { value: "MXN", label: "MXN — Peso mexicano"       },
  { value: "USD", label: "USD — Dólar estadounidense" },
  { value: "EUR", label: "EUR — Euro"                 },
  { value: "COP", label: "COP — Peso colombiano"      },
  { value: "ARS", label: "ARS — Peso argentino"       },
];

const ZONAS = [
  { value: "America/Mexico_City",            label: "Ciudad de México (UTC-6)" },
  { value: "America/Monterrey",              label: "Monterrey (UTC-6)"        },
  { value: "America/Tijuana",                label: "Tijuana (UTC-8)"          },
  { value: "America/Bogota",                 label: "Bogotá (UTC-5)"           },
  { value: "America/Lima",                   label: "Lima (UTC-5)"             },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (UTC-3)"     },
  { value: "America/New_York",               label: "Nueva York (UTC-5)"       },
];

type Tab = "general" | "pagos" | "billar";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General"         },
  { id: "pagos",   label: "Métodos de pago" },
  { id: "billar",  label: "Billar"          },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  config:     ConfigNegocio;
  catalogo:   MetodoPagoGlobal[];
  activados:  string[];
  codCompany: string;
  onCerrar:   () => void;
  onGuardado?: () => void;
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  activo,
  onChange,
  label,
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={label}
      onClick={() => onChange(!activo)}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        border: "none",
        background: activo ? "var(--color-primary)" : "var(--border-strong)",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: activo ? 18 : 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "white",
          transition: "left 0.18s",
          boxShadow: "0 1px 3px rgba(0,0,0,.2)",
        }}
      />
    </button>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ModalConfiguracion({
  config,
  catalogo,
  activados,
  codCompany,
  onCerrar,
  onGuardado,
}: Props) {
  const [tab,      setTab]      = useState<Tab>("general");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const [savedForm, setSavedForm] = useState({
    tNameCompany:      config.tNameCompany,
    imgCompany:        config.imgCompany        ?? "",
    moneda:            config.moneda            ?? "MXN",
    zona_horaria:      config.zona_horaria      ?? "America/Mexico_City",
    aplicarIva:        config.aplicarIva        ?? true,
    costo_hora_billar: config.costo_hora_billar != null
      ? String(config.costo_hora_billar)
      : "",
  });
  const [form, setForm] = useState(savedForm);

  const esBillar = config.tipo_negocio === "billar";

  const [savedMetodos, setSavedMetodos] = useState<string[]>(activados ?? []);
  const [metodosPago, setMetodosPago]   = useState<string[]>(activados ?? []);

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  // Bloquear scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Toggle método — mínimo uno activo
  function toggleMetodo(eCodPay: string) {
    setMetodosPago((prev) => {
      const yaActivo = prev.includes(eCodPay);
      if (yaActivo && prev.length === 1) return prev;
      return yaActivo
        ? prev.filter((id) => id !== eCodPay)
        : [...prev, eCodPay];
    });
  }

  async function handleGuardar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("tNameCompany",      form.tNameCompany);
    fd.append("imgCompany",        form.imgCompany);
    fd.append("moneda",            form.moneda);
    fd.append("zona_horaria",      form.zona_horaria);
    fd.append("aplicarIva",        String(form.aplicarIva));
    fd.append("costo_hora_billar", form.costo_hora_billar);

    const [resConfig, resMetodos] = await Promise.all([
      guardarConfigNegocio(fd),
      guardarMetodosNegocio(codCompany, metodosPago),
    ]);

    setLoading(false);

    const err = resConfig?.error ?? resMetodos?.error;
    if (err) { setError(err); return; }

    setGuardado(true);
    setSavedForm(form);
    setSavedMetodos(metodosPago);
    setTimeout(() => setGuardado(false), 2000);
    onGuardado?.();
  }

  // ── Detectar cambios ──────────────────────────────────────────────────────
  const hayChangesGeneral =
    form.tNameCompany      !== savedForm.tNameCompany      ||
    form.imgCompany        !== savedForm.imgCompany        ||
    form.moneda            !== savedForm.moneda            ||
    form.zona_horaria      !== savedForm.zona_horaria      ||
    form.aplicarIva        !== savedForm.aplicarIva;

  const hayChangesBillar  = form.costo_hora_billar !== savedForm.costo_hora_billar;

  const hayChangesPagos =
    JSON.stringify([...metodosPago].sort()) !==
    JSON.stringify([...savedMetodos].sort());

  const hayChanges = hayChangesGeneral || hayChangesPagos || hayChangesBillar;

  const inicialesNegocio = (form.tNameCompany || config.tNameCompany)
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "??";

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onCerrar()}
      role="dialog"
      aria-modal="true"
      aria-label="Configuración del negocio"
    >
      <div className={styles.sheet}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {form.imgCompany ? (
              <img
                src={form.imgCompany}
                alt={form.tNameCompany}
                className={styles.headerLogoImg}
              />
            ) : (
              <div className={styles.headerLogoFallback}>
                {inicialesNegocio}
              </div>
            )}
            <div>
              <h2 className={styles.titulo}>Configuración</h2>
              <p className={styles.subtitulo}>{form.tNameCompany || config.tNameCompany}</p>
            </div>
          </div>
          <button className={styles.btnCerrar} onClick={onCerrar} aria-label="Cerrar">
            <X size={14} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className={styles.tabs}>
          {TABS.filter((t) => t.id !== "billar" || esBillar).map((t) => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActivo : ""}`}
              onClick={() => { setTab(t.id); setError(null); }}
            >
              {t.label}
              {t.id === "general" && hayChangesGeneral && <span className={styles.tabDot} />}
              {t.id === "pagos"   && hayChangesPagos   && <span className={styles.tabDot} />}
              {t.id === "billar"  && hayChangesBillar  && <span className={styles.tabDot} />}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>

          {/* Tab: General */}
          {tab === "general" && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Logo del negocio</label>
                <ImageUploadInput
                  value={form.imgCompany}
                  onChange={(url) => setForm((p) => ({ ...p, imgCompany: url }))}
                  placeholder="Subir logo"
                  bucket="company-images"
                  storagePath={`negocios/${config.eCodCompany}/logo`}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Nombre del negocio
                  <span className={styles.fieldRequired}>*</span>
                </label>
                <input
                  className={styles.input}
                  type="text"
                  value={form.tNameCompany}
                  onChange={(e) => setForm((p) => ({ ...p, tNameCompany: e.target.value }))}
                  placeholder="Ej. Panadería El Trigal"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Moneda</label>
                <div className={styles.selectWrap}>
                  <select
                    className={styles.input}
                    value={form.moneda}
                    onChange={(e) => setForm((p) => ({ ...p, moneda: e.target.value }))}
                  >
                    {MONEDAS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Zona horaria</label>
                <div className={styles.selectWrap}>
                  <select
                    className={styles.input}
                    value={form.zona_horaria}
                    onChange={(e) => setForm((p) => ({ ...p, zona_horaria: e.target.value }))}
                  >
                    {ZONAS.map((z) => (
                      <option key={z.value} value={z.value}>{z.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── IVA ── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-3) var(--space-4)",
                  background: form.aplicarIva
                    ? "var(--color-primary-50)"
                    : "var(--background)",
                  border: `1px solid ${form.aplicarIva ? "var(--color-primary-light)" : "var(--border-default)"}`,
                  borderRadius: "var(--radius-md)",
                  transition: "all 0.18s",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
                    Aplicar IVA (16%)
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--gray)" }}>
                    {form.aplicarIva
                      ? "El IVA se suma al subtotal en cada venta"
                      : "Los precios se cobran sin IVA adicional"}
                  </p>
                </div>
                <Toggle
                  activo={form.aplicarIva}
                  onChange={(v) => setForm((p) => ({ ...p, aplicarIva: v }))}
                  label="Aplicar IVA"
                />
              </div>

              {!form.aplicarIva && (
                <div className={styles.infoBox}>
                  Al desactivar el IVA, los precios de tus productos se cobran tal cual están registrados.
                </div>
              )}
            </>
          )}

          {/* Tab: Métodos de pago */}
          {tab === "pagos" && (
            <>
              <p className={styles.tabDesc}>
                Activa los métodos disponibles en tu punto de venta.
                Al menos uno debe permanecer activo.
              </p>

              {catalogo.length === 0 ? (
                <div className={styles.infoBox}>
                  No hay métodos de pago configurados en la plataforma todavía.
                  Contacta al administrador del sistema.
                </div>
              ) : (
                <div className={styles.metodosList}>
                  {catalogo.map((m) => {
                    const activo = metodosPago.includes(m.eCodPay);
                    const Icono  = (Icons as any)[m.tIconPay] ?? Icons.CreditCard;
                    return (
                      <button
                        key={m.eCodPay}
                        className={`${styles.metodoItem} ${activo ? styles.metodoItemActivo : ""}`}
                        onClick={() => toggleMetodo(m.eCodPay)}
                        type="button"
                      >
                        <div className={`${styles.metodoIconWrap} ${activo ? styles.metodoIconWrapActivo : ""}`}>
                          <Icono size={18} />
                        </div>
                        <div className={styles.metodoTextos}>
                          <span className={styles.metodoLabel}>{m.tNamePay}</span>
                        </div>
                        <div className={`${styles.metodoCheck} ${activo ? styles.metodoCheckActivo : ""}`}>
                          {activo && <Check size={11} strokeWidth={3} color="white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className={styles.infoBox}>
                Los métodos activos aparecerán en la pantalla de cobro del empleado.
              </div>
            </>
          )}

          {/* Tab: Billar */}
          {tab === "billar" && esBillar && (
            <>
              <p className={styles.tabDesc}>
                Configura el costo por hora de uso de mesa. Este monto se calcula
                proporcionalmente al tiempo que la mesa estuvo abierta y se suma
                automáticamente al total al cobrar.
              </p>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Costo por hora de mesa
                  <span className={styles.fieldRequired}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute", left: 12, top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 13, fontWeight: 600, color: "var(--gray)",
                    pointerEvents: "none",
                  }}>$</span>
                  <input
                    className={styles.input}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ej. 60.00"
                    value={form.costo_hora_billar}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, costo_hora_billar: e.target.value }))
                    }
                    style={{ paddingLeft: 28 }}
                  />
                </div>
                <p style={{ fontSize: 11, color: "var(--gray)", margin: "4px 0 0" }}>
                  Precio final (IVA incluido). Si la mesa estuvo 45 min a $60/hr, se cobrarán $45.
                </p>
              </div>

              <div className={styles.infoBox}>
                El cargo por tiempo se muestra en el desglose al cobrar y queda
                registrado en el historial de ventas.
              </div>
            </>
          )}

          {error && <div className={styles.errorBox}>⚠ {error}</div>}
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <button
            className={styles.btnCancelar}
            onClick={onCerrar}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className={`${styles.btnGuardar} ${guardado ? styles.btnGuardado : ""}`}
            onClick={handleGuardar}
            disabled={loading || !hayChanges || !form.tNameCompany.trim()}
          >
            {loading  ? <Spinner /> :
              guardado ? "Guardado"   :
              "Guardar cambios"
              }
          </button>
        </div>
      </div>
    </div>
  );
}