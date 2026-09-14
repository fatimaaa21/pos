"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Modal, ModalField, ModalInput, ModalSelect } from "@/components/ui/Modal";
import {
  editarGrupoExtra,
  crearOpcionExtra,
  editarOpcionExtra,
  eliminarOpcionExtra,
  toggleEstadoOpcionExtra,
  obtenerInsumosMaestroNegocio,
} from "@/lib/actions/extras";
import type { GrupoExtra, GrupoExtraConOpciones, OpcionExtra } from "@/types";

interface Props {
  grupo:     GrupoExtraConOpciones;
  onClose:   () => void;
  onEditado: (grupo: GrupoExtra) => void;
  onOpcionesCambiaron: (opciones: OpcionExtra[]) => void;
}

interface OpcionFila extends OpcionExtra {
  editando:      boolean;
  nombreEdit:    string;
  precioEdit:    string;
  cantMaxEdit:   string;
  insumoEdit:    string;
  guardandoFila: boolean;
}

function toFila(o: OpcionExtra): OpcionFila {
  return {
    ...o,
    editando:      false,
    nombreEdit:    o.tNombreOpcion,
    precioEdit:    o.ePrecioExtra.toString(),
    cantMaxEdit:   o.eCantidadMaxima.toString(),
    insumoEdit:    o.fkeCodInsumoMaestro ?? "",
    guardandoFila: false,
  };
}

const cellStyle = {
  padding: "8px 10px", fontSize: 12, fontWeight: 600,
  color: "var(--dark)", fontFamily: "var(--font-family)",
} as const;

const headerCellStyle = {
  padding: "6px 10px", fontSize: 11, fontWeight: 700,
  color: "var(--gray)", textTransform: "uppercase" as const,
  letterSpacing: "0.04em", fontFamily: "var(--font-family)",
};

const inputStyle = {
  width: "100%", border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-sm)", padding: "4px 6px",
  fontFamily: "var(--font-family)", fontSize: 12,
} as const;

const iconBtn = (color: string) => ({
  width: 22, height: 22, border: "none", background: "transparent",
  cursor: "pointer", color, display: "flex", alignItems: "center",
  justifyContent: "center", borderRadius: "var(--radius-sm)",
} as const);

export function ModalEditarGrupoExtra({ grupo, onClose, onEditado, onOpcionesCambiaron }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [form, setForm] = useState({
    tNombreGrupo: grupo.tNombreGrupo,
    bSeleccionMultiple: grupo.bSeleccionMultiple,
    bRequerido: grupo.bRequerido,
    eSeleccionMinima: grupo.eSeleccionMinima?.toString() ?? "",
    eSeleccionMaxima: grupo.eSeleccionMaxima?.toString() ?? "",
  });

  const [opciones, setOpciones] = useState<OpcionFila[]>(grupo.opciones.map(toFila));
  const [nuevaOpcion, setNuevaOpcion] = useState({ tNombreOpcion: "", ePrecioExtra: "", eCantidadMaxima: "", fkeCodInsumoMaestro: "" });
  const [guardandoOpcion, setGuardandoOpcion] = useState(false);
  const [insumos, setInsumos] = useState<{ eCodInsumoMaestro: string; tNombre: string }[]>([]);

  useEffect(() => {
    obtenerInsumosMaestroNegocio().then(setInsumos);
  }, []);

  function actualizarOpciones(fn: (prev: OpcionFila[]) => OpcionFila[]) {
    const nuevas = fn(opciones);
    setOpciones(nuevas);
    onOpcionesCambiaron(nuevas);
  }

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("eCodGrupoExtra", grupo.eCodGrupoExtra);
    fd.append("tNombreGrupo", form.tNombreGrupo.trim());
    fd.append("bSeleccionMultiple", String(form.bSeleccionMultiple));
    fd.append("bRequerido", String(form.bRequerido));
    if (form.bSeleccionMultiple) {
      if (form.eSeleccionMinima) fd.append("eSeleccionMinima", form.eSeleccionMinima);
      if (form.eSeleccionMaxima) fd.append("eSeleccionMaxima", form.eSeleccionMaxima);
    }

    const result = await editarGrupoExtra(fd);
    setLoading(false);

    if (result.error) { setError(result.error); return; }
    if (result.grupo) onEditado(result.grupo);
  }

  async function handleCrearOpcion() {
    if (!nuevaOpcion.tNombreOpcion.trim() || nuevaOpcion.ePrecioExtra === "") return;
    setGuardandoOpcion(true);
    setError(null);

    const fd = new FormData();
    fd.append("fkeCodGrupoExtra", grupo.eCodGrupoExtra);
    fd.append("tNombreOpcion", nuevaOpcion.tNombreOpcion.trim());
    fd.append("ePrecioExtra", nuevaOpcion.ePrecioExtra);
    fd.append("eCantidadMaxima", nuevaOpcion.eCantidadMaxima || "1");
    if (nuevaOpcion.fkeCodInsumoMaestro) fd.append("fkeCodInsumoMaestro", nuevaOpcion.fkeCodInsumoMaestro);

    const result = await crearOpcionExtra(fd);
    setGuardandoOpcion(false);

    if (result.error) { setError(result.error); return; }
    if (result.opcion) {
      actualizarOpciones((prev) => [...prev, toFila(result.opcion!)]);
      setNuevaOpcion({ tNombreOpcion: "", ePrecioExtra: "", eCantidadMaxima: "", fkeCodInsumoMaestro: "" });
    }
  }

  function activarEdicionOpcion(id: string) {
    actualizarOpciones((prev) =>
      prev.map((o) => o.eCodOpcionExtra === id
        ? { ...o, editando: true, nombreEdit: o.tNombreOpcion, precioEdit: o.ePrecioExtra.toString(), cantMaxEdit: o.eCantidadMaxima.toString(), insumoEdit: o.fkeCodInsumoMaestro ?? "" }
        : o)
    );
  }

  function cancelarEdicionOpcion(id: string) {
    actualizarOpciones((prev) => prev.map((o) => o.eCodOpcionExtra === id ? { ...o, editando: false } : o));
  }

  async function guardarEdicionOpcion(id: string) {
    const fila = opciones.find((o) => o.eCodOpcionExtra === id);
    if (!fila) return;

    actualizarOpciones((prev) => prev.map((o) => o.eCodOpcionExtra === id ? { ...o, guardandoFila: true } : o));

    const fd = new FormData();
    fd.append("eCodOpcionExtra", id);
    fd.append("tNombreOpcion", fila.nombreEdit);
    fd.append("ePrecioExtra", fila.precioEdit);
    fd.append("eCantidadMaxima", fila.cantMaxEdit || "1");
    if (fila.insumoEdit) fd.append("fkeCodInsumoMaestro", fila.insumoEdit);

    const result = await editarOpcionExtra(fd);

    if (result.error) {
      setError(result.error);
      actualizarOpciones((prev) => prev.map((o) => o.eCodOpcionExtra === id ? { ...o, guardandoFila: false } : o));
      return;
    }
    if (result.opcion) {
      actualizarOpciones((prev) => prev.map((o) => o.eCodOpcionExtra === id ? toFila(result.opcion!) : o));
    }
  }

  async function handleEliminarOpcion(id: string) {
    setError(null);
    const result = await eliminarOpcionExtra(id);
    if (result.error) { setError(result.error); return; }
    actualizarOpciones((prev) => prev.filter((o) => o.eCodOpcionExtra !== id));
  }

  async function handleToggleOpcion(id: string, nuevoEstado: boolean) {
    actualizarOpciones((prev) => prev.map((o) => o.eCodOpcionExtra === id ? { ...o, bStateOpcionExtra: nuevoEstado } : o));
    const result = await toggleEstadoOpcionExtra(id, nuevoEstado);
    if (result.error) {
      setError(result.error);
      actualizarOpciones((prev) => prev.map((o) => o.eCodOpcionExtra === id ? { ...o, bStateOpcionExtra: !nuevoEstado } : o));
    }
  }

  const deshabilitado = !form.tNombreGrupo.trim();

  return (
    <Modal
      titulo={`Editar — ${grupo.tNombreGrupo}`}
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Guardar cambios"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalField label="Nombre del grupo" required>
        <ModalInput
          type="text"
          value={form.tNombreGrupo}
          onChange={(e) => setForm({ ...form, tNombreGrupo: e.target.value })}
          autoFocus
        />
      </ModalField>

      <div style={{ display: "flex", gap: "var(--space-4)", fontSize: 13 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={form.bSeleccionMultiple}
            onChange={(e) => setForm({ ...form, bSeleccionMultiple: e.target.checked })}
          />
          Selección múltiple
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={form.bRequerido}
            onChange={(e) => setForm({ ...form, bRequerido: e.target.checked })}
          />
          Requerido
        </label>
      </div>

      {form.bSeleccionMultiple && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <ModalField label="Mínimo a elegir">
            <ModalInput
              type="number" min={0} placeholder="Sin mínimo"
              value={form.eSeleccionMinima}
              onChange={(e) => setForm({ ...form, eSeleccionMinima: e.target.value })}
            />
          </ModalField>
          <ModalField label="Máximo a elegir">
            <ModalInput
              type="number" min={0} placeholder="Sin máximo"
              value={form.eSeleccionMaxima}
              onChange={(e) => setForm({ ...form, eSeleccionMaxima: e.target.value })}
            />
          </ModalField>
        </div>
      )}

      {/* ── Opciones ── */}
      <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--space-4)" }}>
        <p style={{ margin: "0 0 var(--space-3)", fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
          Opciones
        </p>

        {opciones.length > 0 && (
          <div style={{ border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: "var(--space-3)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px 50px 60px", background: "var(--background)", borderBottom: "1px solid var(--border-light)" }}>
              {["Opción", "Precio", "Cant. máx", "Activo", ""].map((h) => (
                <span key={h} style={headerCellStyle}>{h}</span>
              ))}
            </div>
            {opciones.map((o, idx) => (
              <div
                key={o.eCodOpcionExtra}
                style={{
                  borderBottom: idx < opciones.length - 1 ? "1px solid var(--border-light)" : "none",
                  background: o.editando ? "var(--color-primary-50)" : "white",
                  opacity: o.bStateOpcionExtra ? 1 : 0.55,
                }}
              >
              <div
                style={{
                  display: "grid", gridTemplateColumns: "1fr 80px 70px 50px 60px",
                  alignItems: "center",
                }}
              >
                {o.editando ? (
                  <>
                    <div style={{ padding: "4px 6px" }}>
                      <input type="text" value={o.nombreEdit} style={inputStyle}
                        onChange={(e) => actualizarOpciones((prev) => prev.map((x) => x.eCodOpcionExtra === o.eCodOpcionExtra ? { ...x, nombreEdit: e.target.value } : x))}
                      />
                    </div>
                    <div style={{ padding: "4px 4px" }}>
                      <input type="number" value={o.precioEdit} style={inputStyle}
                        onChange={(e) => actualizarOpciones((prev) => prev.map((x) => x.eCodOpcionExtra === o.eCodOpcionExtra ? { ...x, precioEdit: e.target.value } : x))}
                      />
                    </div>
                    <div style={{ padding: "4px 4px" }}>
                      <input type="number" min={1} value={o.cantMaxEdit} style={inputStyle}
                        onChange={(e) => actualizarOpciones((prev) => prev.map((x) => x.eCodOpcionExtra === o.eCodOpcionExtra ? { ...x, cantMaxEdit: e.target.value } : x))}
                      />
                    </div>
                    <div />
                    <div style={{ display: "flex", gap: 2, padding: "4px 6px", justifyContent: "center" }}>
                      <button onClick={() => guardarEdicionOpcion(o.eCodOpcionExtra)} disabled={o.guardandoFila}
                        style={{ width: 22, height: 22, border: "none", background: "var(--color-primary)", color: "white", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {o.guardandoFila ? "…" : <Check size={11} strokeWidth={3} />}
                      </button>
                      <button onClick={() => cancelarEdicionOpcion(o.eCodOpcionExtra)}
                        style={{ width: 22, height: 22, border: "1px solid var(--border-default)", background: "white", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray)" }}>
                        <X size={11} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span style={cellStyle}>{o.tNombreOpcion}</span>
                    <span style={cellStyle}>${o.ePrecioExtra.toFixed(2)}</span>
                    <span style={{ ...cellStyle, color: "var(--gray)" }}>{o.eCantidadMaxima}</span>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <input type="checkbox" checked={o.bStateOpcionExtra} onChange={(e) => handleToggleOpcion(o.eCodOpcionExtra, e.target.checked)} />
                    </div>
                    <div style={{ display: "flex", gap: 2, padding: "4px 6px", justifyContent: "center" }}>
                      <button onClick={() => activarEdicionOpcion(o.eCodOpcionExtra)} title="Editar" style={iconBtn("var(--gray)")}><Pencil size={12} /></button>
                      <button onClick={() => handleEliminarOpcion(o.eCodOpcionExtra)} title="Eliminar" style={iconBtn("var(--color-error)")}><Trash2 size={12} /></button>
                    </div>
                  </>
                )}
              </div>

              {/* Insumo que esta opción representa — decide qué se descuenta
                  cuando la receta de un producto apunta al grupo en vez de a
                  un insumo fijo. */}
              <div style={{ padding: "0 10px 6px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: "var(--gray)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Insumo:</span>
                {o.editando ? (
                  <div style={{ flex: 1, maxWidth: 220 }}>
                    <ModalSelect
                      value={o.insumoEdit}
                      onChange={(e) => actualizarOpciones((prev) => prev.map((x) => x.eCodOpcionExtra === o.eCodOpcionExtra ? { ...x, insumoEdit: e.target.value } : x))}
                    >
                      <option value="">— sin insumo —</option>
                      {insumos.map((i) => (
                        <option key={i.eCodInsumoMaestro} value={i.eCodInsumoMaestro}>{i.tNombre}</option>
                      ))}
                    </ModalSelect>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: o.fkeCodInsumoMaestro ? "var(--dark)" : "var(--gray)", fontStyle: o.fkeCodInsumoMaestro ? "normal" : "italic" }}>
                    {o.fkeCodInsumoMaestro
                      ? insumos.find((i) => i.eCodInsumoMaestro === o.fkeCodInsumoMaestro)?.tNombre ?? "…"
                      : "sin asignar"}
                  </span>
                )}
              </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px 36px", gap: "var(--space-2)", alignItems: "center" }}>
          <ModalInput
            type="text" placeholder="Opción (ej. Avena)"
            value={nuevaOpcion.tNombreOpcion}
            onChange={(e) => setNuevaOpcion((p) => ({ ...p, tNombreOpcion: e.target.value }))}
          />
          <ModalInput
            type="number" placeholder="Precio"
            value={nuevaOpcion.ePrecioExtra}
            onChange={(e) => setNuevaOpcion((p) => ({ ...p, ePrecioExtra: e.target.value }))}
          />
          <ModalInput
            type="number" placeholder="Máx" min={1}
            value={nuevaOpcion.eCantidadMaxima}
            onChange={(e) => setNuevaOpcion((p) => ({ ...p, eCantidadMaxima: e.target.value }))}
          />
          <button
            type="button"
            onClick={handleCrearOpcion}
            disabled={!nuevaOpcion.tNombreOpcion.trim() || nuevaOpcion.ePrecioExtra === "" || guardandoOpcion}
            title="Agregar opción"
            style={{
              width: 36, height: 36, border: "none",
              background: nuevaOpcion.tNombreOpcion.trim() ? "var(--color-primary)" : "var(--border-default)",
              color: "white", borderRadius: "var(--radius-md)",
              cursor: nuevaOpcion.tNombreOpcion.trim() ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            {guardandoOpcion ? "…" : <Plus size={16} />}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "var(--space-2)" }}>
          <span style={{ fontSize: 10, color: "var(--gray)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Insumo:</span>
          <div style={{ flex: 1, maxWidth: 260 }}>
            <ModalSelect
              value={nuevaOpcion.fkeCodInsumoMaestro}
              onChange={(e) => setNuevaOpcion((p) => ({ ...p, fkeCodInsumoMaestro: e.target.value }))}
            >
              <option value="">— sin insumo —</option>
              {insumos.map((i) => (
                <option key={i.eCodInsumoMaestro} value={i.eCodInsumoMaestro}>{i.tNombre}</option>
              ))}
            </ModalSelect>
          </div>
        </div>

        {opciones.length === 0 && (
          <p style={{ fontSize: 11, color: "var(--gray)", fontStyle: "italic", marginTop: "var(--space-2)" }}>
            Sin opciones todavía — agrega al menos una para que el grupo aparezca en el POS.
          </p>
        )}
      </div>
    </Modal>
  );
}