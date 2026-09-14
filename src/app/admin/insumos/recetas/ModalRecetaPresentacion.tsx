"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Plus, Minus } from "lucide-react";
import { Modal, ModalInput, ModalSelect, ModalInfo } from "@/components/ui/Modal";
import {
  obtenerRecetaPresentacion,
  obtenerInsumosDisponiblesParaReceta,
  obtenerGruposDisponiblesParaReceta,
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
  fkeCodPresentacion?: string | null;
  fkeCodProduct?:      string | null;
  fkeCodOpcionExtra?:  string | null;
  nombrePresentacion?: string;
  nombreProducto?:     string;
  onClose: () => void;
  onCambio: (cantidadInsumos: number) => void; // avisa a la lista para refrescar el contador
}

type FuenteNueva = "insumo" | "grupo";

export function ModalRecetaPresentacion({
  fkeCodPresentacion = null, fkeCodProduct = null, fkeCodOpcionExtra = null,
  nombrePresentacion, nombreProducto,
  onClose, onCambio,
}: Props) {
  // El mecanismo de "resolver por grupo" solo tiene sentido a nivel de
  // producto/presentación — una opción no puede resolverse vía otro grupo.
  const esObjetivoOpcion = !!fkeCodOpcionExtra;

  const [receta, setReceta]           = useState<RecetaInsumoConDatos[]>([]);
  const [insumosDisp, setInsumosDisp] = useState<{ eCodInsumoMaestro: string; tNombre: string; tUnidadReceta: string }[]>([]);
  const [gruposDisp, setGruposDisp]   = useState<{ eCodGrupoExtra: string; tNombreGrupo: string }[]>([]);
  const [cargando, setCargando]       = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const [fuenteNueva, setFuenteNueva]     = useState<FuenteNueva>("insumo");
  const [insumoNuevo, setInsumoNuevo]     = useState("");
  const [grupoNuevo, setGrupoNuevo]       = useState("");
  const [cantidadNueva, setCantidadNueva] = useState("");
  const [agregando, setAgregando]         = useState(false);

  const [guardandoId, setGuardandoId]   = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const [recetaResult, insumosResult, gruposResult] = await Promise.all([
      obtenerRecetaPresentacion(fkeCodPresentacion, fkeCodProduct, fkeCodOpcionExtra),
      obtenerInsumosDisponiblesParaReceta(fkeCodPresentacion, fkeCodProduct, fkeCodOpcionExtra),
      esObjetivoOpcion
        ? Promise.resolve([])
        : obtenerGruposDisponiblesParaReceta(fkeCodPresentacion, fkeCodProduct),
    ]);
    if (recetaResult.error) setError(recetaResult.error);
    setReceta(recetaResult.receta ?? []);
    setInsumosDisp(insumosResult);
    setGruposDisp(gruposResult);
    setCargando(false);
  }

  useEffect(() => {
    (async () => { await cargar(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAgregar() {
    if (!cantidadNueva) return;
    if (fuenteNueva === "insumo" && !insumoNuevo) return;
    if (fuenteNueva === "grupo" && !grupoNuevo) return;

    setAgregando(true);
    setError(null);

    const fd = new FormData();
    if (fkeCodPresentacion) fd.append("fkeCodPresentacion", fkeCodPresentacion);
    if (fkeCodProduct)      fd.append("fkeCodProduct", fkeCodProduct);
    if (fkeCodOpcionExtra)  fd.append("fkeCodOpcionExtra", fkeCodOpcionExtra);
    if (fuenteNueva === "insumo") fd.append("fkeCodInsumoMaestro", insumoNuevo);
    else                           fd.append("fkeCodGrupoExtra", grupoNuevo);
    fd.append("eCantidadNecesaria", cantidadNueva);

    const result = await agregarInsumoAReceta(fd);
    setAgregando(false);

    if (result?.error) {
      setError(result.error);
    } else if (result?.item) {
      const nueva = [...receta, result.item];
      setReceta(nueva);
      if (fuenteNueva === "insumo") {
        setInsumosDisp((prev) => prev.filter((d) => d.eCodInsumoMaestro !== insumoNuevo));
        setInsumoNuevo("");
      } else {
        setGruposDisp((prev) => prev.filter((g) => g.eCodGrupoExtra !== grupoNuevo));
        setGrupoNuevo("");
      }
      setCantidadNueva("");
      onCambio(nueva.length);
      toast.success(
        fuenteNueva === "insumo"
          ? `"${result.item.tNombreInsumo}" agregado a la receta`
          : `"${result.item.tNombreGrupo}" agregado a la receta`
      );
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
      if (item.fkeCodInsumoMaestro) {
        setInsumosDisp((prev) => [
          ...prev,
          { eCodInsumoMaestro: item.fkeCodInsumoMaestro as string, tNombre: item.tNombreInsumo as string, tUnidadReceta: item.tUnidadReceta as string },
        ]);
      } else if (item.fkeCodGrupoExtra) {
        setGruposDisp((prev) => [
          ...prev,
          { eCodGrupoExtra: item.fkeCodGrupoExtra as string, tNombreGrupo: item.tNombreGrupo as string },
        ]);
      }
      onCambio(nueva.length);
      toast.success(`"${item.tNombreInsumo ?? item.tNombreGrupo}" quitado de la receta`);
    }
  }

  const insumoNuevoInfo = insumosDisp.find((d) => d.eCodInsumoMaestro === insumoNuevo);

  const titulo = `Receta — ${nombreProducto} / ${nombrePresentacion}`;

  const sinFuentesDisponibles = insumosDisp.length === 0 && gruposDisp.length === 0;

  return (
    <Modal
      titulo={titulo}
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
                  <span style={{ flex: 1, fontSize: 13 }}>
                    {item.fkeCodGrupoExtra ? (
                      <>
                        {item.tNombreGrupo}{" "}
                        <span style={{ color: "var(--gray)", fontWeight: 500, fontSize: 11 }}>(según selección)</span>
                      </>
                    ) : (
                      item.tNombreInsumo
                    )}
                  </span>

                  <CantidadStepper
                    cantidad={item.eCantidadNecesaria}
                    unidad={item.tUnidadReceta ?? "ml"}
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

          <ModalInfo>Agregar a la receta:</ModalInfo>

          {!esObjetivoOpcion && (
            <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  checked={fuenteNueva === "insumo"}
                  onChange={() => setFuenteNueva("insumo")}
                />
                Insumo fijo
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  checked={fuenteNueva === "grupo"}
                  onChange={() => setFuenteNueva("grupo")}
                />
                Según extra elegido
              </label>
            </div>
          )}

          {sinFuentesDisponibles ? (
            <p style={{ fontSize: 12, color: "var(--gray)" }}>
              No hay más insumos ni grupos de extras disponibles — o ya están todos en la
              receta, o aún no has creado ninguno en Insumos / Extras.
            </p>
          ) : fuenteNueva === "insumo" ? (
            insumosDisp.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--gray)" }}>
                No hay más insumos disponibles para agregar como fijos.
              </p>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <ModalSelect value={insumoNuevo} onChange={(e) => setInsumoNuevo(e.target.value)}>
                    <option value="">Seleccionar insumo...</option>
                    {insumosDisp.map((d) => (
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
            )
          ) : gruposDisp.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--gray)" }}>
              No hay grupos de extras disponibles — o este producto no tiene ninguno asignado
              (actívalo desde Productos), o ya están todos en la receta.
            </p>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <ModalSelect value={grupoNuevo} onChange={(e) => setGrupoNuevo(e.target.value)}>
                  <option value="">Seleccionar grupo...</option>
                  {gruposDisp.map((g) => (
                    <option key={g.eCodGrupoExtra} value={g.eCodGrupoExtra}>{g.tNombreGrupo}</option>
                  ))}
                </ModalSelect>
              </div>
              <div style={{ width: 90 }}>
                <ModalInput
                  type="number"
                  step="0.01"
                  placeholder="cant."
                  value={cantidadNueva}
                  onChange={(e) => setCantidadNueva(e.target.value)}
                />
              </div>
              <button
                onClick={handleAgregar}
                disabled={!grupoNuevo || !cantidadNueva || agregando}
                style={{
                  height: 34, padding: "0 10px", border: "none", borderRadius: 6,
                  background: grupoNuevo && cantidadNueva ? "var(--color-primary, #628321)" : "var(--border-default, #ccc)",
                  color: "#fff", cursor: grupoNuevo && cantidadNueva ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          )}

          {fuenteNueva === "grupo" && (
            <p style={{ fontSize: 11, color: "var(--gray)", marginTop: 6, fontStyle: "italic" }}>
              La cantidad aplica por cada unidad de opción elegida — no descuenta nada hasta
              que la opción tenga un insumo asignado (en Extras).
            </p>
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
  const [valor, setValor]       = useState("");
  const inputRef                = useRef<HTMLInputElement>(null);

  // Sin useEffect: mientras no se está editando, el valor mostrado viene
  // directo del prop en cada render — nada que sincronizar.
  const valorMostrado = editando ? valor : String(cantidad);

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
        value={valorMostrado}
        className={pedidoStyles.cantidadInput}
        style={{ width: Math.max(32, valorMostrado.length * 10 + 8) }}
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