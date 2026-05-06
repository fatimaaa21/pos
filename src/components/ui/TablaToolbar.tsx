"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X, Check, RefreshCw } from "lucide-react";
import styles from "./TablaToolbar.module.css";

export interface FiltrosUsuario {
  busqueda: string;
  roles: ("admin" | "empleado")[];
  estados: ("activo" | "inactivo")[];
}

interface TablaToolbarProps {
  filtros: FiltrosUsuario;
  onChange: (filtros: FiltrosUsuario) => void;
  total: number;
  ocultarRol?: boolean;
}

// ── Dropdown genérico ─────────────────────────────────────────────────────────

interface DropdownFiltroProps {
  label: string;
  opciones: { value: string; label: string }[];
  seleccionados: string[];
  onToggle: (value: string) => void;
  onLimpiar: () => void;
}

function DropdownFiltro({ label, opciones, seleccionados, onToggle, onLimpiar }: DropdownFiltroProps) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const valorMostrado =
    seleccionados.length === 0
      ? "Todos"
      : seleccionados.length === 1
      ? opciones.find((o) => o.value === seleccionados[0])?.label ?? seleccionados[0]
      : `${seleccionados.length} selec.`;

  const activo = seleccionados.length > 0;

  return (
    <div className={styles.dropWrap} ref={ref}>
      <button
        className={`${styles.dropBtn} ${activo ? styles.dropBtnActive : ""}`}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className={styles.dropLabel}>{label}:</span>
        <span className={styles.dropValor}>{valorMostrado}</span>
        <ChevronDown
          size={11}
          className={`${styles.chevron} ${abierto ? styles.chevronOpen : ""}`}
        />
      </button>

      {abierto && (
        <div className={styles.dropdown}>
          {/* Opción Todos */}
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

// ── Componente principal ──────────────────────────────────────────────────────

export function TablaToolbar({ filtros, onChange, total, ocultarRol = false }: TablaToolbarProps) {
  function setBusqueda(busqueda: string) {
    onChange({ ...filtros, busqueda });
  }

  function toggleRol(rol: string) {
    const roles = filtros.roles.includes(rol as "admin" | "empleado")
      ? filtros.roles.filter((r) => r !== rol)
      : [...filtros.roles, rol as "admin" | "empleado"];
    onChange({ ...filtros, roles });
  }

  function toggleEstado(estado: string) {
    const estados = filtros.estados.includes(estado as "activo" | "inactivo")
      ? filtros.estados.filter((e) => e !== estado)
      : [...filtros.estados, estado as "activo" | "inactivo"];
    onChange({ ...filtros, estados });
  }

  const hayFiltros =
    filtros.roles.length > 0 || filtros.estados.length > 0 || filtros.busqueda;

  return (
    <div className={styles.toolbar}>
      {/* Buscador */}
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

      <div className={styles.divider} />

      {/* Dropdown estado */}
      <DropdownFiltro
        label="Estado"
        opciones={[
          { value: "activo", label: "Activo" },
          { value: "inactivo", label: "Inactivo" },
        ]}
        seleccionados={filtros.estados}
        onToggle={toggleEstado}
        onLimpiar={() => onChange({ ...filtros, estados: [] })}
      />

      {/* Dropdown rol */}
      {!ocultarRol && (
        <DropdownFiltro
          label="Rol"
          opciones={[
            { value: "admin", label: "Admin" },
            { value: "empleado", label: "Empleado" },
          ]}
          seleccionados={filtros.roles}
          onToggle={toggleRol}
          onLimpiar={() => onChange({ ...filtros, roles: [] })}
        />
      )}

      {/* Limpiar todo */}
      {hayFiltros && (
        <button
          className={styles.limpiarBtn}
          onClick={() => onChange({ busqueda: "", roles: [], estados: [] })}
          title="Limpiar filtros"
        >
          <RefreshCw size={13} />
        </button>
      )}
    </div>
  );
}