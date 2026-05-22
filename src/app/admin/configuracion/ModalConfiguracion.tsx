import { useEffect, useRef, useState } from "react";
import { X, CreditCard, Globe, Check, Banknote, Smartphone } from "lucide-react";
import { guardarConfigNegocio, type ConfigNegocio } from "@/lib/actions/configuracion";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";
import styles from "./ModalConfiguracion.module.css";

// ── Opciones ─────────────────────────────────────────────────────────────────

const MONEDAS = [
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "USD", label: "USD — Dólar estadounidense" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "COP", label: "COP — Peso colombiano" },
  { value: "ARS", label: "ARS — Peso argentino" },
];

const ZONAS = [
  { value: "America/Mexico_City", label: "Ciudad de México (UTC-6)" },
  { value: "America/Monterrey",   label: "Monterrey (UTC-6)" },
  { value: "America/Tijuana",     label: "Tijuana (UTC-8)" },
  { value: "America/Bogota",      label: "Bogotá (UTC-5)" },
  { value: "America/Lima",        label: "Lima (UTC-5)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (UTC-3)" },
  { value: "America/New_York",    label: "Nueva York (UTC-5)" },
];

const METODOS_PAGO = [
  { value: "efectivo",      label: "Efectivo",       icon: Banknote },
  { value: "tarjeta",       label: "Tarjeta",        icon: CreditCard },
  { value: "transferencia", label: "QR / Transfer",  icon: Smartphone },
];

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "general" | "pagos";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "pagos",   label: "Métodos de pago" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  config:   ConfigNegocio;
  onCerrar: () => void;
  onGuardado?: (config: ConfigNegocio) => void;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ModalConfiguracion({ config, onCerrar, onGuardado }: Props) {
  const [tab,          setTab]          = useState<Tab>("general");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [guardado,     setGuardado]     = useState(false);

  const [form, setForm] = useState({
    tNameCompany: config.tNameCompany,
    imgCompany:   config.imgCompany ?? "",
    moneda:       config.moneda,
    zona_horaria: config.zona_horaria,
    metodosPago:  config.metodosPago,
  });

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

  // Toggle método de pago
  function toggleMetodo(value: string) {
    setForm((prev) => {
      const ya = prev.metodosPago.includes(value);
      // Al menos uno debe quedar activo
      if (ya && prev.metodosPago.length === 1) return prev;
      return {
        ...prev,
        metodosPago: ya
          ? prev.metodosPago.filter((m) => m !== value)
          : [...prev.metodosPago, value],
      };
    });
  }

  async function handleGuardar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("tNameCompany", form.tNameCompany);
    fd.append("imgCompany",   form.imgCompany);
    fd.append("moneda",       form.moneda);
    fd.append("zona_horaria", form.zona_horaria);
    form.metodosPago.forEach((m) => fd.append("metodosPago", m));

    const result = await guardarConfigNegocio(fd);

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
    onGuardado?.({ ...config, ...form });
  }

  const hayChanges =
    form.tNameCompany !== config.tNameCompany ||
    form.imgCompany   !== (config.imgCompany ?? "") ||
    form.moneda       !== config.moneda ||
    form.zona_horaria !== config.zona_horaria ||
    JSON.stringify(form.metodosPago.slice().sort()) !==
      JSON.stringify(config.metodosPago.slice().sort());

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
                {(form.tNameCompany || config.tNameCompany)
                  .split(" ")
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "??"}
              </div>
            )}
            <div>
              <h2 className={styles.titulo}>Configuración</h2>
              <p className={styles.subtitulo}>{form.tNameCompany || config.tNameCompany}</p>
            </div>
          </div>
          <button
            className={styles.btnCerrar}
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActivo : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>

          {/* ── Tab: General ── */}
          {tab === "general" && (
            <>
              {/* Logo */}
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

              {/* Nombre */}
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

              {/* Moneda */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Moneda
                </label>
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

              {/* Zona horaria */}
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
            </>
          )}

          {/* ── Tab: Métodos de pago ── */}
          {tab === "pagos" && (
            <>
              <p className={styles.tabDesc}>
                Activa los métodos de pago disponibles en el punto de venta.
                Al menos uno debe permanecer activo.
              </p>

              <div className={styles.metodosList}>
                {METODOS_PAGO.map(({ value, label, icon: Icon }) => {
                  const activo = form.metodosPago.includes(value);
                  return (
                    <button
                      key={value}
                      className={`${styles.metodoItem} ${activo ? styles.metodoItemActivo : ""}`}
                      onClick={() => toggleMetodo(value)}
                      type="button"
                    >
                      <div className={`${styles.metodoIconWrap} ${activo ? styles.metodoIconWrapActivo : ""}`}>
                        <Icon size={18} />
                      </div>
                      <span className={styles.metodoLabel}>{label}</span>
                      <div className={`${styles.metodoCheck} ${activo ? styles.metodoCheckActivo : ""}`}>
                        {activo && <Check size={11} strokeWidth={3} color="white" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className={styles.infoBox}>
                Los métodos activos aparecerán en la pantalla de cobro del empleado.
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className={styles.errorBox}>
              ⚠ {error}
            </div>
          )}
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
            {loading   ? "Guardando..."     :
             guardado  ? "✓ Guardado"       :
             "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}