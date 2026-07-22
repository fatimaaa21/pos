"use client";

import { useState, useEffect, useTransition } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Power } from "lucide-react";
import {
  obtenerConceptosBillar,
  crearConceptoBillar,
  editarConceptoBillar,
  toggleConceptoBillar,
} from "@/lib/actions/conceptos-billar";
import type { ConceptoBillar } from "@/types";
import styles from "@/app/admin/configuracion/ModalConfiguracion.module.css";
import { Spinner } from "@/components/ui/Spinner/Spinner";


function ActionBtn({
  children, title, onClick, danger, loading,
}: {
  children: React.ReactNode;
  title:    string;
  onClick:  () => void;
  danger?:  boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={loading}
      className={`${styles.actionBtn} ${danger ? styles.actionBtnDanger : ""}`}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function ConceptosBillarClient() {
  const [conceptos, setConceptos]     = useState<ConceptoBillar[] | null>(null);
  const [editandoId, setEditandoId]   = useState<string | null>(null);
  const [nombreForm, setNombreForm]   = useState("");
  const [costoForm, setCostoForm]     = useState("");
  const [creando, setCreando]         = useState(false);
  const [isPending, startTransition]  = useTransition();

  useEffect(() => {
    obtenerConceptosBillar().then(setConceptos);
  }, []);

  function iniciarEdicion(c: ConceptoBillar) {
    setEditandoId(c.eCodConcepto);
    setNombreForm(c.tNombre);
    setCostoForm(String(c.eCostoHora));
    setCreando(false);
  }

  function iniciarCreacion() {
    setCreando(true);
    setEditandoId(null);
    setNombreForm("");
    setCostoForm("");
  }

  function cancelar() {
    setEditandoId(null);
    setCreando(false);
    setNombreForm("");
    setCostoForm("");
  }

  function handleGuardar() {
    const costo = parseFloat(costoForm);

    startTransition(async () => {
      if (creando) {
        const result = await crearConceptoBillar(nombreForm, costo);
        if ("error" in result) { toast.error(result.error); return; }
        setConceptos((prev) => [
          ...(prev ?? []),
          { eCodConcepto: result.eCodConcepto, tNombre: nombreForm.trim(), eCostoHora: costo, bActivo: true, fkeCodCompany: "", fhCreate: new Date().toISOString() },
        ]);
        toast.success("Concepto creado");
      } else if (editandoId) {
        const result = await editarConceptoBillar(editandoId, nombreForm, costo);
        if ("error" in result) { toast.error(result.error); return; }
        setConceptos((prev) =>
          (prev ?? []).map((c) => c.eCodConcepto === editandoId ? { ...c, tNombre: nombreForm.trim(), eCostoHora: costo } : c)
        );
        toast.success("Concepto actualizado");
      }
      cancelar();
    });
  }

  function handleToggle(c: ConceptoBillar) {
    startTransition(async () => {
      const result = await toggleConceptoBillar(c.eCodConcepto, !c.bActivo);
      if ("error" in result) { toast.error(result.error); return; }
      setConceptos((prev) =>
        (prev ?? []).map((x) => x.eCodConcepto === c.eCodConcepto ? { ...x, bActivo: !x.bActivo } : x)
      );
    });
  }

  const enFormulario = creando || editandoId !== null;

  if (conceptos === null) {
    return <p className={styles.tabDesc}>Cargando conceptos…</p>;
  }

  return (
    <>
      {conceptos.length === 0 && !enFormulario && (
        <p className={styles.tabDesc}>
          No hay conceptos configurados todavía. Sin al menos uno, no vas a poder abrir mesas.
        </p>
      )}

      {conceptos.length > 0 && (
        <div className={styles.metodosList}>
          {conceptos.map((c) => (
            <div
              key={c.eCodConcepto}
              className={styles.metodoItem}
              style={{ opacity: c.bActivo ? 1 : 0.5, cursor: "default" }}
            >
              <div className={styles.metodoTextos}>
                <span className={styles.metodoLabel}>
                  {c.tNombre} {!c.bActivo && "(inactivo)"}
                </span>
                <span style={{ fontSize: 12, color: "var(--gray)" }}>
                  ${c.eCostoHora.toFixed(2)} / hora
                </span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <ActionBtn title="Editar" onClick={() => iniciarEdicion(c)} loading={isPending}>
                  <Pencil size={16} />
                </ActionBtn>
                <ActionBtn
                  title={c.bActivo ? "Desactivar" : "Reactivar"}
                  onClick={() => handleToggle(c)}
                  loading={isPending}
                >
                  <Power size={16} />
                </ActionBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {enFormulario ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              Nombre <span className={styles.fieldRequired}>*</span>
            </label>
            <input
              className={styles.input}
              placeholder="Ej. Billar, Domino"
              value={nombreForm}
              onChange={(e) => setNombreForm(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              Costo por hora <span className={styles.fieldRequired}>*</span>
            </label>
            <input
              className={styles.input}
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Ej. 60.00"
              value={costoForm}
              onChange={(e) => setCostoForm(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button type="button" className={styles.btnCancelar} onClick={cancelar} disabled={isPending}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.btnGuardar}
              onClick={handleGuardar}
              disabled={isPending || !nombreForm.trim() || !costoForm}
            >
              {creando ? "Crear" : "Guardar"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.btnCancelar}
          style={{ flex: "none", display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
          onClick={iniciarCreacion}
        >
          <Plus size={14} /> Nuevo concepto
        </button>
      )}
    </>
  );
}