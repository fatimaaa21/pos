"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import toast            from "react-hot-toast";
import { Plus, Minus, Trash2 } from "lucide-react";
import {
  crearMesaLayout,
  guardarLayoutMesas,
  eliminarMesaLayout,
  toggleMesaLayout,
  abrirMesaLayout,
  cancelarMesaLayout,
} from "@/lib/actions/mesas-layout";
import styles from "./LayoutEditorMesas.module.css";
import type { MesaEditorData } from "./mesas-editor-types";
import type { ConceptoBillar } from "@/types";

const COLS = 10;
const ROWS = 6;

// MesaEditorData imported from ./mesas-editor-types

interface Props {
  mesasIniciales:   MesaEditorData[];
  pathRevalidar:    string;
  tipo_negocio:     "general" | "impresion" | "billar";
  conceptos:        ConceptoBillar[];
}

export function LayoutEditorMesas({ mesasIniciales, pathRevalidar, tipo_negocio, conceptos }: Props) {
  const [mesas,      setMesas]      = useState<MesaEditorData[]>(mesasIniciales);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [liveCell,   setLiveCell]   = useState<{ col: number; row: number } | null>(null);
  const [hayCambios, setHayCambios] = useState(false);
  const [guardando,  setGuardando]  = useState(false);
  const [agregando,  setAgregando]  = useState(false);
  const [toggling,   setToggling]   = useState(false);
  const [abriendo,   setAbriendo]   = useState(false);
  const [cerrando,   setCerrando]   = useState(false);
  const [isMobile,   setIsMobile]   = useState(false);

  const esBillar = tipo_negocio === "billar";
  const [ahora, setAhora] = useState<Date | null>(null);

  const conceptoPorId = new Map(conceptos.map(c => [c.eCodConcepto, c]));

  function costoHoraDeMesa(mesa: MesaEditorData): number | null {
    if (!mesa.fkeCodConcepto) return null;
    return conceptoPorId.get(mesa.fkeCodConcepto)?.eCostoHora ?? null;
  }

  useEffect(() => {
    setAhora(new Date());
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  function formatTiempo(fhAbierta: string): string {
    if (!ahora) return "00:00:00";
    const diff     = Math.max(0, ahora.getTime() - new Date(fhAbierta).getTime());
    const totalSeg = Math.floor(diff / 1000);
    const h   = Math.floor(totalSeg / 3600);
    const min = Math.floor((totalSeg % 3600) / 60);
    const seg = totalSeg % 60;
    return [h, min, seg].map(n => String(n).padStart(2, "0")).join(":");
  }

  function calcCosto(mesa: MesaEditorData, fhAbierta: string): number {
    const costoHora = costoHoraDeMesa(mesa);
    if (!costoHora || !ahora) return 0;
    const diff  = Math.max(0, ahora.getTime() - new Date(fhAbierta).getTime());
    return Math.round((diff / 3600000) * costoHora * 100) / 100;
  }

  const canvasRef  = useRef<HTMLDivElement>(null);
  const floatRef   = useRef<HTMLDivElement>(null); // elemento flotante visual, manipulado directo en DOM
  const liveCellRef = useRef<{ col: number; row: number } | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const mesaSeleccionada = mesas.find(m => m.eCodMesa === selectedId) ?? null;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getCell(clientX: number, clientY: number) {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const col  = Math.floor((clientX - rect.left) / (rect.width  / COLS));
    const row  = Math.floor((clientY - rect.top)  / (rect.height / ROWS));
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { col, row };
  }

  const celdaOcupada = useCallback(
    (col: number, row: number, ignorarId?: string) =>
      mesas.some(m => {
        if (m.eCodMesa === ignorarId) return false;
        return col >= m.e_grid_col && col < m.e_grid_col + m.e_grid_w &&
               row >= m.e_grid_row && row < m.e_grid_row + m.e_grid_h;
      }),
    [mesas]
  );

  const mesaCabe = useCallback(
    (col: number, row: number, w: number, h: number, ignorarId?: string): boolean => {
      if (col < 0 || row < 0 || col + w > COLS || row + h > ROWS) return false;
      for (let c = col; c < col + w; c++)
        for (let r = row; r < row + h; r++)
          if (celdaOcupada(c, r, ignorarId)) return false;
      return true;
    },
    [celdaOcupada]
  );

  const primeraLibre = useCallback(
    (w = 1, h = 1) => {
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (mesaCabe(c, r, w, h)) return { col: c, row: r };
      return null;
    },
    [mesaCabe]
  );

  // ── Drag con pointer events nativos ───────────────────────────────────────
  // CLAVE: onMove / onUp / onCancel se definen DENTRO de handleMesaPointerDown.
  // Esto garantiza que add/remove usen la MISMA referencia de función.
  // Sin esto, removeEventListener no puede encontrar el listener y se acumula.
  //
  // El elemento flotante (floatRef) se mueve via DOM directo — sin React state.
  // Solo liveCell (para el highlight de celdas) usa setState.

  function handleMesaPointerDown(e: React.PointerEvent<HTMLDivElement>, mesa: MesaEditorData) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(mesa.eCodMesa);

    const startX  = e.clientX;
    const startY  = e.clientY;
    let   active  = false;

    // Capturar mesaCabe del cierre actual (mesas no cambia durante drag)
    const cabeFn = mesaCabe;

    function onMove(ev: PointerEvent) {
      // Activar solo al superar el umbral
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
        active = true;
        setDraggingId(mesa.eCodMesa);

        // Preparar elemento flotante
        const float = floatRef.current;
        if (float && canvasRef.current) {
          const rect   = canvasRef.current.getBoundingClientRect();
          const cellW  = rect.width  / COLS;
          const cellH  = rect.height / ROWS;
          float.textContent = mesa.tNombre;
          float.style.width  = `${cellW * mesa.e_grid_w - 8}px`;
          float.style.height = `${cellH * mesa.e_grid_h - 8}px`;
          float.style.borderRadius = mesa.t_shape === "circle" ? "50%" : "";
          float.style.display = "flex";
        }
      }

      // Mover elemento flotante directamente en DOM (sin React, instantáneo)
      const float = floatRef.current;
      if (float) {
        const w = parseFloat(float.style.width)  || 60;
        const h = parseFloat(float.style.height) || 60;
        float.style.left = `${ev.clientX - w / 2}px`;
        float.style.top  = `${ev.clientY - h / 2}px`;
      }

      // Actualizar celda highlight via React state (solo cuando cambia la celda)
      const cell = getCell(ev.clientX, ev.clientY);
      if (cell) {
        if (liveCellRef.current?.col !== cell.col || liveCellRef.current?.row !== cell.row) {
          liveCellRef.current = cell;
          setLiveCell(cell);
        }
      } else {
        if (liveCellRef.current !== null) {
          liveCellRef.current = null;
          setLiveCell(null);
        }
      }
    }

    function onUp(ev: PointerEvent) {
      // Remover MISMA referencia que se registró — esto es lo que faltaba antes
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointercancel", onCancel);

      // Ocultar elemento flotante
      if (floatRef.current) floatRef.current.style.display = "none";

      const wasActive = active;
      active = false;

      const cell        = getCell(ev.clientX, ev.clientY) ?? liveCellRef.current;
      liveCellRef.current = null;

      setDraggingId(null);
      setLiveCell(null);

      if (!wasActive || !cell) return;

      // cabeFn y mesa.e_grid_w/h vienen del cierre — mesas no cambió durante drag
      if (!cabeFn(cell.col, cell.row, mesa.e_grid_w, mesa.e_grid_h, mesa.eCodMesa)) {
        toast.error("No cabe ahí");
        return;
      }
      if (cell.col === mesa.e_grid_col && cell.row === mesa.e_grid_row) return;

      setMesas(prev =>
        prev.map(m =>
          m.eCodMesa === mesa.eCodMesa
            ? { ...m, e_grid_col: cell.col, e_grid_row: cell.row }
            : m
        )
      );
      setHayCambios(true);
    }

    function onCancel() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup",   onUp);
      if (floatRef.current) floatRef.current.style.display = "none";
      active              = false;
      liveCellRef.current = null;
      setDraggingId(null);
      setLiveCell(null);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup",   onUp,     { once: true });
    document.addEventListener("pointercancel", onCancel, { once: true });
  }


  // ── Activar / desactivar mesa ──────────────────────────────────────────────

  async function togglearMesa(eCodMesa: string, bActiva: boolean) {
    setToggling(true);
    const result = await toggleMesaLayout(eCodMesa, bActiva);
    setToggling(false);
    if ("error" in result) { toast.error(result.error); return; }
    setMesas(prev =>
      prev.map(m => m.eCodMesa === eCodMesa ? { ...m, bStateMesa: bActiva } : m)
    );
    toast.success(bActiva ? "Mesa activada" : "Mesa desactivada");
  }


  // ── Abrir mesa (iniciar orden) ────────────────────────────────────────────

  async function abrirMesa(eCodMesa: string) {
    setAbriendo(true);
    const result = await abrirMesaLayout(eCodMesa);
    setAbriendo(false);
    if ("error" in result) { toast.error(result.error); return; }
    setMesas(prev =>
      prev.map(m =>
        m.eCodMesa === eCodMesa
          ? { ...m, ordenAbierta: { eCodOrden: result.eCodOrden, fhAbierta: result.fhAbierta } }
          : m
      )
    );
    toast.success("Mesa abierta — el tiempo corre");
  }


  // ── Cancelar mesa (sin cobro) ────────────────────────────────────────────
  // Solo para mesas abiertas por error. El cobro real va desde el menú POS.

  function confirmarCancelarMesa(eCodMesa: string, eCodOrden: string) {
    toast(
      t => (
        <div className={styles.toastConfirm}>
          <span>¿Cerrar esta mesa <strong>sin cobrar</strong>?</span>
          <div className={styles.toastButtons}>
            <button className={styles.toastBtnCancel} onClick={() => toast.dismiss(t.id)}>
              No
            </button>
            <button
              className={styles.toastBtnConfirm}
              onClick={async () => {
                toast.dismiss(t.id);
                setCerrando(true);
                const result = await cancelarMesaLayout(eCodOrden, pathRevalidar);
                setCerrando(false);
                if ("error" in result) { toast.error(result.error); return; }
                setMesas(prev =>
                  prev.map(m => m.eCodMesa === eCodMesa ? { ...m, ordenAbierta: null } : m)
                );
                toast.success("Mesa cerrada sin cobro");
              }}
            >
              Cerrar mesa
            </button>
          </div>
        </div>
      ),
      { duration: Infinity }
    );
  }

  // ── Agregar ───────────────────────────────────────────────────────────────

  async function agregarMesa(shape: "rect" | "circle") {
    const pos = primeraLibre();
    if (!pos) { toast.error("No hay espacio disponible"); return; }
    setAgregando(true);
    const tNombre = `M${mesas.length + 1}`;
    // En negocios billar la mesa nace sin concepto asignado — se elige en
    // "Mesa seleccionada". El toggle "Mesa abierta" queda bloqueado hasta
    // que se asigne, para no cobrar con una tarifa adivinada.
    const result  = await crearMesaLayout({
      tNombre, t_shape: shape,
      e_grid_col: pos.col, e_grid_row: pos.row, e_grid_w: 1, e_grid_h: 1,
      fkeCodConcepto: null,
    });
    setAgregando(false);
    if ("error" in result) { toast.error(result.error); return; }
    setMesas(prev => [...prev, {
      eCodMesa:    result.eCodMesa,
      tNombre,
      t_shape:     shape,
      e_grid_col:  pos.col,
      e_grid_row:  pos.row,
      e_grid_w:    1,
      e_grid_h:    1,
      bStateMesa:  true,
      fkeCodConcepto: null,
      ordenAbierta: null,
    }]);
    setSelectedId(result.eCodMesa);
    if (esBillar) {
      toast.success(conceptos.length
        ? "Mesa creada — asigna su tarifa en el panel"
        : "Mesa creada — primero configura un concepto de tarifa en Configuración");
    } else {
      toast.success("Mesa creada");
    }
  }

  // ── Redimensionar ─────────────────────────────────────────────────────────

  function cambiarTamano(campo: "e_grid_w" | "e_grid_h", delta: 1 | -1) {
    if (!mesaSeleccionada) return;
    const nuevo = mesaSeleccionada[campo] + delta;
    if (nuevo < 1) return;
    const w = campo === "e_grid_w" ? nuevo : mesaSeleccionada.e_grid_w;
    const h = campo === "e_grid_h" ? nuevo : mesaSeleccionada.e_grid_h;
    if (!mesaCabe(mesaSeleccionada.e_grid_col, mesaSeleccionada.e_grid_row, w, h, mesaSeleccionada.eCodMesa)) {
      toast.error("No hay espacio para ampliar");
      return;
    }
    setMesas(prev => prev.map(m => m.eCodMesa === selectedId ? { ...m, [campo]: nuevo } : m));
    setHayCambios(true);
  }

  // ── Renombrar ─────────────────────────────────────────────────────────────

  function renombrar(nombre: string) {
    setMesas(prev => prev.map(m => m.eCodMesa === selectedId ? { ...m, tNombre: nombre } : m));
    setHayCambios(true);
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  function confirmarEliminar() {
    if (!mesaSeleccionada) return;
    const { tNombre: nombre, eCodMesa: id } = mesaSeleccionada;
    toast(
      t => (
        <div className={styles.toastConfirm}>
          <span>¿Eliminar <strong>{nombre}</strong>?</span>
          <div className={styles.toastButtons}>
            <button className={styles.toastBtnCancel} onClick={() => toast.dismiss(t.id)}>No</button>
            <button className={styles.toastBtnConfirm} onClick={async () => {
              toast.dismiss(t.id);
              const r = await eliminarMesaLayout(id, pathRevalidar);
              if ("error" in r) { toast.error(r.error); return; }
              setMesas(prev => prev.filter(m => m.eCodMesa !== id));
              setSelectedId(null);
              toast.success(`${nombre} eliminada`);
            }}>Eliminar</button>
          </div>
        </div>
      ),
      { duration: Infinity }
    );
  }

  // ── Cambiar concepto de tarifa (solo billar) ────────────────────────────────

  function cambiarConcepto(fkeCodConcepto: string) {
    setMesas(prev => prev.map(m => m.eCodMesa === selectedId ? { ...m, fkeCodConcepto } : m));
    setHayCambios(true);
  }

  // ── Guardar ───────────────────────────────────────────────────────────────

  async function guardar() {
    setGuardando(true);
    const tid = toast.loading("Guardando layout...");
    const r   = await guardarLayoutMesas(
      mesas.map(m => ({
        eCodMesa: m.eCodMesa, tNombre: m.tNombre,
        e_grid_col: m.e_grid_col, e_grid_row: m.e_grid_row,
        e_grid_w: m.e_grid_w,    e_grid_h: m.e_grid_h,
        fkeCodConcepto: esBillar ? (m.fkeCodConcepto ?? null) : undefined,
      })),
      pathRevalidar
    );
    setGuardando(false);
    if ("error" in r) { toast.error(r.error, { id: tid }); return; }
    toast.success("Layout guardado", { id: tid });
    setHayCambios(false);
  }

  // ── Mobile ────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className={styles.mobileBlock}>
        <p className={styles.mobileTitle}>Editor no disponible en este dispositivo</p>
        <p className={styles.mobileDesc}>Ábrelo desde una computadora o tablet.</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const dragMesa = mesas.find(m => m.eCodMesa === draggingId);

  return (
    <div className={styles.root} onClick={() => setSelectedId(null)}>

      {/* Canvas */}
      <div className={styles.canvasWrapper}>
        <div
          ref={canvasRef}
          className={styles.canvas}
          style={{
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows:    `repeat(${ROWS}, 1fr)`,
          }}
        >
          {/* Celdas: fondo + highlight de liveCell */}
          {Array.from({ length: COLS * ROWS }).map((_, i) => {
            const col    = i % COLS;
            const row    = Math.floor(i / COLS);
            const enLive = liveCell && dragMesa &&
              col >= liveCell.col && col < liveCell.col + dragMesa.e_grid_w &&
              row >= liveCell.row && row < liveCell.row + dragMesa.e_grid_h;
            const puede  = enLive
              ? mesaCabe(liveCell!.col, liveCell!.row, dragMesa!.e_grid_w, dragMesa!.e_grid_h, draggingId ?? undefined)
              : false;

            return (
              <div
                key={`${col}-${row}`}
                className={[
                  styles.cell,
                  enLive && puede  ? styles.cellCanDrop : "",
                  enLive && !puede ? styles.cellNoDrop  : "",
                ].filter(Boolean).join(" ")}
                style={{
                  gridColumn: col + 1,
                  gridRow:    row + 1,
                }}
              />
            );
          })}

          {/* Mesas */}
          {mesas.map(mesa => (
            <div
              key={mesa.eCodMesa}
              className={[
                styles.mesa,
                mesa.t_shape === "circle"      ? styles.mesaCircle   : "",
                selectedId === mesa.eCodMesa   ? styles.mesaSelected : "",
                draggingId === mesa.eCodMesa   ? styles.mesaDragging : "",
                !mesa.bStateMesa               ? styles.mesaInactiva : "",
                !!mesa.ordenAbierta            ? styles.mesaAbierta  : "",
              ].filter(Boolean).join(" ")}
              style={{
                gridColumn: `${mesa.e_grid_col + 1} / span ${mesa.e_grid_w}`,
                gridRow:    `${mesa.e_grid_row + 1} / span ${mesa.e_grid_h}`,
              }}
              onPointerDown={e => handleMesaPointerDown(e, mesa)}
              onClick={e => { e.stopPropagation(); setSelectedId(mesa.eCodMesa); }}
            >
              <span className={styles.mesaNombre}>{mesa.tNombre}</span>
              {(mesa.e_grid_w > 1 || mesa.e_grid_h > 1) && (
                <span className={styles.mesaDim}>{mesa.e_grid_w}×{mesa.e_grid_h}</span>
              )}
              {mesa.ordenAbierta && (
                <span className={styles.mesaTimer}>
                  {formatTiempo(mesa.ordenAbierta.fhAbierta)}
                </span>
              )}
              {mesa.ordenAbierta && esBillar && costoHoraDeMesa(mesa) && (
                <span className={styles.mesaCostoCard}>
                  ${calcCosto(mesa, mesa.ordenAbierta.fhAbierta).toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Panel lateral */}
      <aside className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.panelSection}>
          <p className={styles.panelLabel}>Agregar mesa</p>
          <div className={styles.addButtons}>
            <button className={styles.btnAdd} onClick={() => agregarMesa("rect")}   disabled={agregando}><Plus size={14} /> Rectangular</button>
            <button className={styles.btnAdd} onClick={() => agregarMesa("circle")} disabled={agregando}><Plus size={14} /> Circular</button>
          </div>
        </div>

        {mesaSeleccionada ? (
          <>
            {/* Nombre y tamaño */}
            <div className={styles.panelSection}>
              <p className={styles.panelLabel}>Mesa seleccionada</p>
              <input className={styles.nameInput} value={mesaSeleccionada.tNombre} onChange={e => renombrar(e.target.value)} maxLength={12} placeholder="Nombre" />
              <div className={styles.sizeRow}>
                <span className={styles.sizeLabel}>Ancho</span>
                <button className={styles.btnSize} onClick={() => cambiarTamano("e_grid_w", -1)}><Minus size={12} /></button>
                <span className={styles.sizeVal}>{mesaSeleccionada.e_grid_w}</span>
                <button className={styles.btnSize} onClick={() => cambiarTamano("e_grid_w", 1)}><Plus size={12} /></button>
              </div>
              <div className={styles.sizeRow}>
                <span className={styles.sizeLabel}>Alto</span>
                <button className={styles.btnSize} onClick={() => cambiarTamano("e_grid_h", -1)}><Minus size={12} /></button>
                <span className={styles.sizeVal}>{mesaSeleccionada.e_grid_h}</span>
                <button className={styles.btnSize} onClick={() => cambiarTamano("e_grid_h", 1)}><Plus size={12} /></button>
              </div>

              {esBillar && (
                <div style={{ marginTop: 10 }}>
                  <span className={styles.sizeLabel} style={{ display: "block", marginBottom: 4 }}>
                    Se cobra como
                  </span>
                  {conceptos.length === 0 ? (
                    <p style={{ fontSize: 11, color: "var(--color-error)", margin: 0 }}>
                      No hay conceptos configurados. Ve a Configuración → Costos.
                    </p>
                  ) : (
                    <select
                      className={styles.nameInput}
                      value={mesaSeleccionada.fkeCodConcepto ?? ""}
                      onChange={e => cambiarConcepto(e.target.value)}
                    >
                      <option value="" disabled>Selecciona un concepto</option>
                      {conceptos.map(c => (
                        <option key={c.eCodConcepto} value={c.eCodConcepto}>
                          {c.tNombre} - ${c.eCostoHora.toFixed(2)}/hr
                        </option>
                      ))}
                    </select>
                  )}
                  {!mesaSeleccionada.fkeCodConcepto && conceptos.length > 0 && (
                    <p style={{ fontSize: 11, color: "var(--gray)", margin: "4px 0 0" }}>
                      Sin tarifa asignada — no se puede abrir hasta elegir una.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className={styles.panelSection}>
              <p className={styles.panelLabel}>Acciones</p>

              {/* Switch: mesa activa/inactiva */}
              <div className={styles.switchRow}>
                <div>
                  <p className={styles.switchLabel}>Mesa activa</p>
                  <p className={styles.switchDesc}>
                    {mesaSeleccionada.bStateMesa ? "Visible para empleados" : "Oculta para empleados"}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={mesaSeleccionada.bStateMesa}
                  className={`${styles.switch} ${mesaSeleccionada.bStateMesa ? styles.switchOn : ""}`}
                  onClick={() => togglearMesa(mesaSeleccionada.eCodMesa, !mesaSeleccionada.bStateMesa)}
                  disabled={toggling}
                />
              </div>

              {/* Switch: abrir / cerrar mesa */}
              <div className={styles.switchRow}>
                <div>
                  <p className={styles.switchLabel}>Mesa abierta</p>
                  <p className={styles.switchDesc}>
                    {mesaSeleccionada.ordenAbierta
                      ? "En curso"
                      : esBillar && !mesaSeleccionada.fkeCodConcepto
                        ? "Asigna y guarda un concepto primero"
                        : esBillar && hayCambios
                          ? "Guarda el layout antes de abrir"
                          : "Inicia el tiempo al abrir"}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={!!mesaSeleccionada.ordenAbierta}
                  className={`${styles.switch} ${mesaSeleccionada.ordenAbierta ? styles.switchOn : ""}`}
                  onClick={() => {
                    if (mesaSeleccionada.ordenAbierta) {
                      confirmarCancelarMesa(
                        mesaSeleccionada.eCodMesa,
                        mesaSeleccionada.ordenAbierta.eCodOrden
                      );
                    } else {
                      abrirMesa(mesaSeleccionada.eCodMesa);
                    }
                  }}
                  disabled={
                    abriendo || cerrando || !mesaSeleccionada.bStateMesa ||
                    (esBillar && !mesaSeleccionada.ordenAbierta &&
                      (!mesaSeleccionada.fkeCodConcepto || hayCambios))
                  }
                />
              </div>

              <button className={styles.btnEliminar} onClick={confirmarEliminar}>
                <Trash2 size={14} /> Eliminar mesa
              </button>
            </div>


          </>
        ) : (
          <div className={styles.panelHintWrap}>
            <p className={styles.panelHint}>Selecciona una mesa para editarla o arrástrala para moverla.</p>
          </div>
        )}

        <div className={styles.panelFooter}>
          {hayCambios && <p className={styles.cambiosPendientes}>● Cambios sin guardar</p>}
          <button className={styles.btnGuardar} onClick={guardar} disabled={!hayCambios || guardando}>
            {guardando ? "Guardando..." : "Guardar layout"}
          </button>
        </div>
      </aside>

      {/* Elemento flotante visual — sigue al cursor via DOM directo, sin React state */}
      <div ref={floatRef} className={styles.floatingMesa} style={{ display: "none" }} />
    </div>
  );
}