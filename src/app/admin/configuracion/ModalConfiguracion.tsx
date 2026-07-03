"use client";

import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";
import * as Icons from "lucide-react";
import { guardarConfigNegocio, type ConfigNegocio } from "@/lib/actions/configuracion";
import { guardarMetodosNegocio, type MetodoPagoGlobal } from "@/lib/actions/metodos-pago";
import {
  listarConceptosBillar,
  crearConceptoBillar,
  actualizarConceptoBillar,
  eliminarConceptoBillar,
} from "@/lib/actions/conceptos-billar";
import type { ConceptoBillar } from "@/types";
import { Trash2, Pencil } from "lucide-react";
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
  { id: "billar",  label: "Costos"          },
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

// ── Tab de conceptos de billar (CRUD inmediato) ────────────────────────────────
// A diferencia de "General" y "Métodos de pago", cada acción aquí pega
// directo a la DB (no se batchea con "Guardar cambios"). Esto es intencional:
// los conceptos se referencian desde las mesas (mesas.fkeCodConcepto), así que
// dejarlos en un estado "pendiente de guardar" sería confuso si el admin
// cierra el modal sin darle a Guardar.

function ConceptosBillarTab({ codCompany }: { codCompany: string }) {
  const [conceptos, setConceptos]   = useState<ConceptoBillar[] | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [costoNuevo,  setCostoNuevo]  = useState("");
  const [creando,     setCreando]     = useState(false);
  const [editandoId,  setEditandoId]  = useState<string | null>(null);
  const [nombreEdit,  setNombreEdit]  = useState("");
  const [costoEdit,   setCostoEdit]   = useState("");
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarConceptosBillar().then(setConceptos);
  }, []);

  async function handleCrear() {
    setError(null);
    const costo = parseFloat(costoNuevo);
    if (!nombreNuevo.trim()) { setError("Dale un nombre al concepto (ej. Billar, Dominó)"); return; }
    if (!Number.isFinite(costo) || costo <= 0) { setError("Costo por hora inválido"); return; }

    setCreando(true);
    const r = await crearConceptoBillar(nombreNuevo, costo);
    setCreando(false);
    if ("error" in r) { setError(r.error); return; }
    setConceptos((prev) => [...(prev ?? []), r]);
    setNombreNuevo("");
    setCostoNuevo("");
  }

  function empezarEdicion(c: ConceptoBillar) {
    setEditandoId(c.eCodConcepto);
    setNombreEdit(c.tNombre);
    setCostoEdit(String(c.eCostoHora));
    setError(null);
  }

  async function handleGuardarEdicion(eCodConcepto: string) {
    setError(null);
    const costo = parseFloat(costoEdit);
    if (!nombreEdit.trim()) { setError("El nombre no puede quedar vacío"); return; }
    if (!Number.isFinite(costo) || costo <= 0) { setError("Costo por hora inválido"); return; }

    setGuardandoEdit(true);
    const r = await actualizarConceptoBillar(eCodConcepto, nombreEdit, costo);
    setGuardandoEdit(false);
    if ("error" in r) { setError(r.error); return; }
    setConceptos((prev) =>
      (prev ?? []).map((c) =>
        c.eCodConcepto === eCodConcepto ? { ...c, tNombre: nombreEdit.trim(), eCostoHora: costo } : c
      )
    );
    setEditandoId(null);
  }

  async function handleEliminar(c: ConceptoBillar) {
    setError(null);
    setEliminandoId(c.eCodConcepto);
    const r = await eliminarConceptoBillar(c.eCodConcepto);
    setEliminandoId(null);
    if ("error" in r) { setError(r.error); return; }
    setConceptos((prev) => (prev ?? []).filter((x) => x.eCodConcepto !== c.eCodConcepto));
  }

  return (
    <>
      <p className={styles.tabDesc}>
        Cada concepto define un costo por hora distinto.
        Cada mesa se asigna a uno de estos conceptos desde el editor de Mesas, 
        ahí se decide con cuál tarifa se cobra cada mesa.
      </p>

      {conceptos === null ? (
        <Spinner />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {conceptos.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--gray)" }}>
              Todavía no hay conceptos configurados.
            </p>
          )}

          {conceptos.map((c) => (
            <div
              key={c.eCodConcepto}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)",
                padding: "8px 10px",
              }}
            >
              {editandoId === c.eCodConcepto ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <input
                    className={styles.input}
                    style={{ width: "100%" }}
                    value={nombreEdit}
                    onChange={(e) => setNombreEdit(e.target.value)}
                    placeholder="Nombre del concepto"
                    autoFocus
                  />
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <span style={{
                        position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                        fontSize: 13, fontWeight: 600, color: "var(--gray)", pointerEvents: "none",
                      }}>$</span>
                      <input
                        className={styles.input}
                        style={{ width: "100%", paddingLeft: 22 }}
                        type="number" min="0" step="0.01"
                        value={costoEdit}
                        onChange={(e) => setCostoEdit(e.target.value)}
                        placeholder="Costo por hora"
                      />
                    </div>
                    <button
                      className={styles.btnGuardar}
                      style={{ padding: "6px 14px", whiteSpace: "nowrap" }}
                      onClick={() => handleGuardarEdicion(c.eCodConcepto)}
                      disabled={guardandoEdit}
                    >
                      {guardandoEdit ? <Spinner /> : "Guardar"}
                    </button>
                    <button
                      className={styles.btnCancelar}
                      style={{ padding: "6px 14px", whiteSpace: "nowrap" }}
                      onClick={() => setEditandoId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, margin: 0 }}>{c.tNombre}</p>
                    <p style={{ fontSize: 12, color: "var(--gray)", margin: 0 }}>
                      ${c.eCostoHora.toFixed(2)} / hora
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => empezarEdicion(c)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray)", padding: 6 }}
                    aria-label={`Editar ${c.tNombre}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEliminar(c)}
                    disabled={eliminandoId === c.eCodConcepto}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-error)", padding: 6 }}
                    aria-label={`Eliminar ${c.tNombre}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Nuevo concepto</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className={styles.input}
            style={{ flex: 1 }}
            placeholder="Ej. Dominó"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            maxLength={30}
          />
          <div style={{ position: "relative", width: 110 }}>
            <span style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              fontSize: 13, fontWeight: 600, color: "var(--gray)", pointerEvents: "none",
            }}>$</span>
            <input
              className={styles.input}
              type="number" min="0" step="0.01"
              placeholder="60.00"
              value={costoNuevo}
              onChange={(e) => setCostoNuevo(e.target.value)}
              style={{ paddingLeft: 24 }}
            />
          </div>
          <button className={styles.btnGuardar} onClick={handleCrear} disabled={creando}>
            {creando ? <Spinner /> : "Agregar"}
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--gray)", margin: "4px 0 0" }}>
          Precio final (IVA incluido). Se calcula proporcionalmente al tiempo que la mesa estuvo abierta.
        </p>
      </div>

      {error && <div className={styles.errorBox}>⚠ {error}</div>}

      <div className={styles.infoBox}>
        Eliminar un concepto solo es posible si ninguna mesa lo tiene asignado.
      </div>
    </>
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

  const hayChangesPagos =
    JSON.stringify([...metodosPago].sort()) !==
    JSON.stringify([...savedMetodos].sort());

  const hayChanges = hayChangesGeneral || hayChangesPagos;

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
            <ConceptosBillarTab codCompany={codCompany} />
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