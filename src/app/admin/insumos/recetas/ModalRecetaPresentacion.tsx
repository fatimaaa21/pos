"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Plus, Minus } from "lucide-react";
import { Modal, ModalInput, ModalSelect, ModalInfo } from "@/components/ui/Modal";
import {
  obtenerRecetaPresentacion,
  obtenerInsumosDisponiblesParaReceta,
  agregarInsumoAReceta,
  editarCantidadRecetaInsumo,
  eliminarInsumoDeReceta,
} from "@/lib/actions/receta-insumos";
import type { RecetaInsumoConDatos } from "@/types";
import toast from "react-hot-toast";
// Reutiliza el mismo stepper visual que el panel de venta para editar cantidad —
// mismas clases, mismo comportamiento (click para escribir, +/- para ajustar).
import pedidoStyles from "@/components/ui/PedidoPanel/PedidoPanel.module.css";

interface Props {
  fkeCodPresentacion: string;
  nombrePresentacion: string;
  nombreProducto:      string;
  onClose: () => void;
  onCambio: (cantidadInsumos: number) => void; // avisa a la lista para refrescar el contador
}

export function ModalRecetaPresentacion({ fkeCodPresentacion, nombrePresentacion, nombreProducto, onClose, onCambio }: Props) {
  const [receta, setReceta]           = useState<RecetaInsumoConDatos[]>([]);
  const [disponibles, setDisponibles] = useState<{ eCodInsumoMaestro: string; tNombre: string; tUnidadReceta: string }[]>([]);
  const [cargando, setCargando]       = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const [insumoNuevo, setInsumoNuevo]     = useState("");
  const [cantidadNueva, setCantidadNueva] = useState("");
  const [agregando, setAgregando]         = useState(false);

  const [guardandoId, setGuardandoId]   = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    const [recetaResult, disponiblesResult] = await Promise.all([
      obtenerRecetaPresentacion(fkeCodPresentacion),
      obtenerInsumosDisponiblesParaReceta(fkeCodPresentacion),
    ]);
    if (recetaResult.error) setError(recetaResult.error);
    setReceta(recetaResult.receta ?? []);
    setDisponibles(disponiblesResult);
    setCargando(false);
  }

  async function handleAgregar() {
    if (!insumoNuevo || !cantidadNueva) return;
    setAgregando(true);
    setError(null);

    const fd = new FormData();
    fd.append("fkeCodPresentacion", fkeCodPresentacion);
    fd.append("fkeCodInsumoMaestro", insumoNuevo);
    fd.append("eCantidadNecesaria", cantidadNueva);

    const result = await agregarInsumoAReceta(fd);
    setAgregando(false);

    if (result?.error) {
      setError(result.error);
    } else if (result?.item) {
      const nueva = [...receta, result.item];
      setReceta(nueva);
      setDisponibles((prev) => prev.filter((d) => d.eCodInsumoMaestro !== insumoNuevo));
      setInsumoNuevo("");
      setCantidadNueva("");
      onCambio(nueva.length);
      toast.success(`"${result.item.tNombreInsumo}" agregado a la receta`);
    }
  }

  // Guarda inmediatamente (sin botón de confirmar aparte), igual que el
  // stepper de cantidad en el panel de venta: cada cambio se guarda al toque.
  async function actualizarCantidad(item: RecetaInsumoConDatos, nuevaCantidad: number) {
    if (nuevaCantidad <= 0) return; // usar el ícono de basura para quitar, no bajar a 0

    setGuardandoId(item.eCodReceta);
    const fd = new FormData();
    fd.append("eCodReceta", item.eCodReceta);
    fd.append("eCantidadNecesaria", String(nuevaCantidad));

    const result = await editarCantidadRecetaInsumo(fd);
    setGuardandoId(null);

    if (result?.error) {
      toast.error(result.error);
    } else if (result?.item) {
      setReceta((prev) => prev.map((r) => (r.eCodReceta === item.eCodReceta ? result.item! : r)));
    }
  }

  async function handleEliminar(item: RecetaInsumoConDatos) {
    setEliminandoId(item.eCodReceta);
    const result = await eliminarInsumoDeReceta(item.eCodReceta);
    setEliminandoId(null);

    if (result?.error) {
      toast.error(result.error);
    } else {
      const nueva = receta.filter((r) => r.eCodReceta !== item.eCodReceta);
      setReceta(nueva);
      setDisponibles((prev) => [
        ...prev,
        { eCodInsumoMaestro: item.fkeCodInsumoMaestro, tNombre: item.tNombreInsumo, tUnidadReceta: item.tUnidadReceta },
      ]);
      onCambio(nueva.length);
      toast.success(`"${item.tNombreInsumo}" quitado de la receta`);
    }
  }

  const insumoNuevoInfo = disponibles.find((d) => d.eCodInsumoMaestro === insumoNuevo);

  return (
    <Modal
      titulo={`Receta — ${nombreProducto} / ${nombrePresentacion}`}
      onCerrar={onClose}
      labelCancelar="Cerrar"
      error={error}
      ancho="sm"
    >
      {cargando ? (
        <p style={{ fontSize: 12, color: "var(--gray)" }}>Cargando receta…</p>
      ) : (
        <>
          {receta.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--gray)", marginBottom: 12 }}>
              Esta presentación no tiene receta — no se descontará ningún insumo al venderla.
            </p>
          ) : (
            <div style={{ marginBottom: 12 }}>
              {receta.map((item) => (
                <div
                  key={item.eCodReceta}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-default, #eee)" }}
                >
                  <span style={{ flex: 1, fontSize: 13 }}>{item.tNombreInsumo}</span>

                  <CantidadStepper
                    cantidad={item.eCantidadNecesaria}
                    unidad={item.tUnidadReceta}
                    guardando={guardandoId === item.eCodReceta}
                    onConfirm={(nueva) => actualizarCantidad(item, nueva)}
                  />

                  <button
                    onClick={() => handleEliminar(item)}
                    disabled={eliminandoId === item.eCodReceta}
                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--color-error)", padding: "2px 4px" }}
                    title="Quitar de la receta"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <ModalInfo>Agregar insumo a la receta:</ModalInfo>

          {disponibles.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--gray)" }}>
              No hay más insumos disponibles — o ya están todos en la receta, o
              aún no has creado ninguno en Insumos.
            </p>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <ModalSelect value={insumoNuevo} onChange={(e) => setInsumoNuevo(e.target.value)}>
                  <option value="">Seleccionar insumo...</option>
                  {disponibles.map((d) => (
                    <option key={d.eCodInsumoMaestro} value={d.eCodInsumoMaestro}>{d.tNombre}</option>
                  ))}
                </ModalSelect>
              </div>
              <div style={{ width: 90 }}>
                <ModalInput
                  type="number"
                  step="0.01"
                  placeholder={insumoNuevoInfo ? insumoNuevoInfo.tUnidadReceta : "cant."}
                  value={cantidadNueva}
                  onChange={(e) => setCantidadNueva(e.target.value)}
                />
              </div>
              <button
                onClick={handleAgregar}
                disabled={!insumoNuevo || !cantidadNueva || agregando}
                style={{
                  height: 34, padding: "0 10px", border: "none", borderRadius: 6,
                  background: insumoNuevo && cantidadNueva ? "var(--color-primary, #628321)" : "var(--border-default, #ccc)",
                  color: "#fff", cursor: insumoNuevo && cantidadNueva ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

// ── Stepper de cantidad — mismo patrón visual y de interacción que
// ItemCantidadInput en PedidoPanel.tsx: click para escribir directo (útil
// para decimales como gramos), o +/- para ajustar de 1 en 1. Guarda al
// perder el foco o presionar Enter, igual que en el panel de venta.
function CantidadStepper({
  cantidad, unidad, guardando, onConfirm,
}: {
  cantidad: number; unidad: string; guardando: boolean; onConfirm: (nueva: number) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor]       = useState(String(cantidad));
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editando) setValor(String(cantidad));
  }, [cantidad, editando]);

  function handleFocus() {
    setEditando(true);
    setValor(String(cantidad));
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function confirmar() {
    const parsed = parseFloat(valor);
    if (isNaN(parsed) || parsed <= 0) {
      setValor(String(cantidad)); // valor inválido — revertir sin guardar
      setEditando(false);
      return;
    }
    if (parsed !== cantidad) onConfirm(parsed);
    setValor(String(parsed));
    setEditando(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter")  { e.preventDefault(); confirmar(); }
    if (e.key === "Escape") { setValor(String(cantidad)); setEditando(false); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button
        className={pedidoStyles.btnCantidad}
        disabled={guardando}
        onClick={() => onConfirm(Math.max(0.01, cantidad - 1))}
      >
        <Minus size={11} strokeWidth={2.5} />
      </button>

      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        step="0.01"
        min={0.01}
        value={valor}
        className={pedidoStyles.cantidadInput}
        style={{ width: Math.max(32, valor.length * 10 + 8) }}
        disabled={guardando}
        onChange={(e) => setValor(e.target.value)}
        onFocus={handleFocus}
        onBlur={confirmar}
        onKeyDown={handleKeyDown}
      />

      <button
        className={pedidoStyles.btnCantidad}
        disabled={guardando}
        onClick={() => onConfirm(cantidad + 1)}
      >
        <Plus size={11} strokeWidth={2.5} />
      </button>

      <span style={{ fontSize: 11, color: "var(--gray)", minWidth: 24 }}>{unidad}</span>
    </div>
  );
}