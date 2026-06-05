// src/components/ui/TablaToolbar.tsx
// Cambio: los filtros van dentro de .toolbarScroll para que
// el overflow-x no corte los dropdowns verticalmente.
"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X, Check, RefreshCw, Banknote, CreditCard, Smartphone } from "lucide-react";
import styles from "./TablaToolbar.module.css";

export interface FiltrosUsuario {
  busqueda:    string;
  roles:       ("admin" | "empleado")[];
  estados:     ("activo" | "inactivo")[];
  categorias?: string[];
  stocks?:     ("disponible" | "bajo" | "agotado")[];
  periodo?:    "hoy" | "semana" | "mes" | "todo";
  metodo?:     string;
  empleado?:   string;
  estadoFiltro?: string; // estado de venta/corte (no usar con estados activo/inactivo)
}

interface TablaToolbarProps {
  filtros:   FiltrosUsuario;
  onChange:  (filtros: FiltrosUsuario) => void;
  total:     number;
  ocultarRol?:         boolean;
  ocultarEstado?:      boolean;
  opcionesCategorias?: { value: string; label: string }[];
  mostrarStock?:       boolean;
  mostrarPeriodo?:     boolean;
  mostrarMetodo?:      boolean;
  opcionesMetodo?:     { value: string; label: string }[];
  empleados?:          { id: string; nombre: string }[];
  opcionesEstadoFiltro?: { value: string; label: string }[];
}

// ── DropdownMulti ─────────────────────────────────────────────────────────────
interface DropdownMultiProps {
  label:         string;
  opciones:      { value: string; label: string }[];
  seleccionados: string[];
  onToggle:      (value: string) => void;
  onLimpiar:     () => void;
}

function DropdownMulti({ label, opciones, seleccionados, onToggle, onLimpiar }: DropdownMultiProps) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const valorMostrado =
    seleccionados.length === 0 ? "Todos" :
    seleccionados.length === 1 ? (opciones.find((o) => o.value === seleccionados[0])?.label ?? seleccionados[0]) :
    `${seleccionados.length} selec.`;

  const activo = seleccionados.length > 0;

  return (
    <div className={styles.dropWrap} ref={ref}>
      <button
        className={`${styles.dropBtn} ${activo ? styles.dropBtnActive : ""}`}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className={styles.dropLabel}>{label}:</span>
        <span className={styles.dropValor}>{valorMostrado}</span>
        <ChevronDown size={11} className={`${styles.chevron} ${abierto ? styles.chevronOpen : ""}`} />
      </button>

      {abierto && (
        <div className={styles.dropdown}>
          <button
            className={`${styles.ddItem} ${seleccionados.length === 0 ? styles.ddItemActive : ""}`}
            onClick={() => { onLimpiar(); setAbierto(false); }}
          >
            <span className={`${styles.ddRadio} ${seleccionados.length === 0 ? styles.ddRadioOn : ""}`} />
            Todos
          </button>
          <div className={styles.ddSep} />
          {opciones.map((op) => {
            const sel = seleccionados.includes(op.value);
            return (
              <button
                key={op.value}
                className={`${styles.ddItem} ${sel ? styles.ddItemActive : ""}`}
                onClick={() => onToggle(op.value)}
              >
                <span className={`${styles.ddCheck} ${sel ? styles.ddCheckOn : ""}`}>
                  {sel && <Check size={10} strokeWidth={3} color="white" />}
                </span>
                {op.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── DropdownSingle ────────────────────────────────────────────────────────────
interface DropdownSingleProps {
  label:    string;
  opciones: { value: string; label: string; icon?: React.ReactNode }[];
  valor:    string;
  onChange: (v: string) => void;
}

function DropdownSingle({ label, opciones, valor, onChange }: DropdownSingleProps) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const opcionActual = opciones.find((o) => o.value === valor);
  const activo = valor !== opciones[0]?.value;

  return (
    <div className={styles.dropWrap} ref={ref}>
      <button
        className={`${styles.dropBtn} ${activo ? styles.dropBtnActive : ""}`}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className={styles.dropLabel}>{label}:</span>
        <span className={styles.dropValor}>{opcionActual?.label ?? "Todos"}</span>
        <ChevronDown size={11} className={`${styles.chevron} ${abierto ? styles.chevronOpen : ""}`} />
      </button>

      {abierto && (
        <div className={styles.dropdown}>
          {opciones.map((op, i) => {
            const sel = op.value === valor;
            return (
              <div key={op.value}>
                {i === 1 && <div className={styles.ddSep} />}
                <button
                  className={`${styles.ddItem} ${sel ? styles.ddItemActive : ""}`}
                  onClick={() => { onChange(op.value); setAbierto(false); }}
                >
                  {i === 0 ? (
                    <span className={`${styles.ddRadio} ${sel ? styles.ddRadioOn : ""}`} />
                  ) : (
                    <span className={`${styles.ddCheck} ${sel ? styles.ddCheckOn : ""}`}>
                      {sel && <Check size={10} strokeWidth={3} color="white" />}
                    </span>
                  )}
                  {op.icon && <span style={{ display: "flex", alignItems: "center", opacity: 0.65 }}>{op.icon}</span>}
                  {op.label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Constantes ────────────────────────────────────────────────────────────────
const OPCIONES_STOCK = [
  { value: "disponible", label: "Disponible" },
  { value: "bajo",       label: "Stock bajo" },
  { value: "agotado",    label: "Agotado"    },
];

const OPCIONES_PERIODO = [
  { value: "hoy",    label: "Hoy"         },
  { value: "semana", label: "Esta semana" },
  { value: "mes",    label: "Este mes"    },
  { value: "todo",   label: "Todo"        },
];

const OPCIONES_METODO_LEGACY = [
  { value: "todos",         label: "Todos"         },
  { value: "efectivo",      label: "Efectivo",      icon: <Banknote   size={12} /> },
  { value: "tarjeta",       label: "Tarjeta",       icon: <CreditCard size={12} /> },
  { value: "transferencia", label: "QR / Transfer", icon: <Smartphone size={12} /> },
];

// ── Componente principal ──────────────────────────────────────────────────────
export function TablaToolbar({
  filtros, onChange, total,
  ocultarRol      = false,
  ocultarEstado   = false,
  opcionesCategorias,
  mostrarStock    = false,
  mostrarPeriodo  = false,
  mostrarMetodo   = false,
  opcionesMetodo,
  opcionesEstadoFiltro,
  empleados,
}: TablaToolbarProps) {

  function setBusqueda(busqueda: string) { onChange({ ...filtros, busqueda }); }
  function toggleRol(rol: string) {
    const roles = filtros.roles.includes(rol as any) ? filtros.roles.filter((r) => r !== rol) : [...filtros.roles, rol as any];
    onChange({ ...filtros, roles });
  }
  function toggleEstado(estado: string) {
    const estados = filtros.estados.includes(estado as any) ? filtros.estados.filter((e) => e !== estado) : [...filtros.estados, estado as any];
    onChange({ ...filtros, estados });
  }
  function toggleCategoria(cat: string) {
    const prev = filtros.categorias ?? [];
    onChange({ ...filtros, categorias: prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat] });
  }
  function toggleStock(stock: string) {
    const prev = filtros.stocks ?? [];
    onChange({ ...filtros, stocks: prev.includes(stock as any) ? prev.filter((s) => s !== stock) : [...prev, stock as any] });
  }

  const hayFiltros =
    filtros.roles.length > 0 || filtros.estados.length > 0 || filtros.busqueda ||
    (filtros.categorias?.length ?? 0) > 0 || (filtros.stocks?.length ?? 0) > 0 ||
    (filtros.periodo && filtros.periodo !== "hoy") ||
    (filtros.metodo  && filtros.metodo  !== "todos") ||
    (filtros.empleado && filtros.empleado !== "todos") ||
    (filtros.estadoFiltro && filtros.estadoFiltro !== "todos");

  const opcionesEmpleado = [
    { value: "todos", label: "Todos" },
    ...(empleados ?? []).map((e) => ({ value: e.id, label: e.nombre })),
  ];

  return (
    <div className={styles.toolbar}>
      {/* Buscador: siempre visible, no scrollea */}
      <div className={styles.searchWrap}>
        <Search size={13} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Buscar..."
          value={filtros.busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {filtros.busqueda && (
          <button className={styles.searchClear} onClick={() => setBusqueda("")}>
            <X size={11} />
          </button>
        )}
      </div>

      {/* 
        .toolbarScroll — en mobile este div hace el scroll horizontal.
        El toolbar exterior queda overflow: visible para que los dropdowns
        no queden cortados.
      */}
      <div className={styles.toolbarScroll}>

        {!ocultarEstado && (
          <>
            <div className={styles.divider} />
            <DropdownMulti
              label="Estado"
              opciones={[{ value: "activo", label: "Activo" }, { value: "inactivo", label: "Inactivo" }]}
              seleccionados={filtros.estados}
              onToggle={toggleEstado}
              onLimpiar={() => onChange({ ...filtros, estados: [] })}
            />
          </>
        )}

        {!ocultarRol && (
          <>
            <div className={styles.divider} />
            <DropdownMulti
              label="Rol"
              opciones={[{ value: "admin", label: "Admin" }, { value: "empleado", label: "Empleado" }]}
              seleccionados={filtros.roles}
              onToggle={toggleRol}
              onLimpiar={() => onChange({ ...filtros, roles: [] })}
            />
          </>
        )}

        {opcionesCategorias && opcionesCategorias.length > 0 && (
          <>
            <div className={styles.divider} />
            <DropdownMulti
              label="Categoría"
              opciones={opcionesCategorias}
              seleccionados={filtros.categorias ?? []}
              onToggle={toggleCategoria}
              onLimpiar={() => onChange({ ...filtros, categorias: [] })}
            />
          </>
        )}

        {mostrarStock && (
          <>
            <div className={styles.divider} />
            <DropdownMulti
              label="Stock"
              opciones={OPCIONES_STOCK}
              seleccionados={filtros.stocks ?? []}
              onToggle={toggleStock}
              onLimpiar={() => onChange({ ...filtros, stocks: [] })}
            />
          </>
        )}

        {mostrarPeriodo && (
          <>
            <div className={styles.divider} />
            <DropdownSingle
              label="Período"
              opciones={OPCIONES_PERIODO}
              valor={filtros.periodo ?? "hoy"}
              onChange={(v) => onChange({ ...filtros, periodo: v as FiltrosUsuario["periodo"] })}
            />
          </>
        )}

        {opcionesMetodo && opcionesMetodo.length > 1 && (
          <>
            <div className={styles.divider} />
            <DropdownSingle
              label="Método"
              opciones={opcionesMetodo}
              valor={filtros.metodo ?? "todos"}
              onChange={(v) => onChange({ ...filtros, metodo: v })}
            />
          </>
        )}

        {mostrarMetodo && !opcionesMetodo && (
          <>
            <div className={styles.divider} />
            <DropdownSingle
              label="Método"
              opciones={OPCIONES_METODO_LEGACY}
              valor={filtros.metodo ?? "todos"}
              onChange={(v) => onChange({ ...filtros, metodo: v })}
            />
          </>
        )}


        {opcionesEstadoFiltro && opcionesEstadoFiltro.length > 1 && (
          <>
            <div className={styles.divider} />
            <DropdownSingle
              label="Estado"
              opciones={opcionesEstadoFiltro}
              valor={filtros.estadoFiltro ?? "todos"}
              onChange={(v) => onChange({ ...filtros, estadoFiltro: v })}
            />
          </>
        )}

        {empleados && empleados.length > 1 && (
          <>
            <div className={styles.divider} />
            <DropdownSingle
              label="Empleado"
              opciones={opcionesEmpleado}
              valor={filtros.empleado ?? "todos"}
              onChange={(v) => onChange({ ...filtros, empleado: v })}
            />
          </>
        )}

        {hayFiltros && (
          <button
            className={styles.limpiarBtn}
            onClick={() => onChange({ busqueda: "", roles: [], estados: [], categorias: [], stocks: [], periodo: "hoy", metodo: "todos", empleado: "todos", estadoFiltro: "todos" })}
            title="Limpiar filtros"
          >
            <RefreshCw size={13} />
          </button>
        )}

      </div>{/* /toolbarScroll */}
    </div>
  );
}