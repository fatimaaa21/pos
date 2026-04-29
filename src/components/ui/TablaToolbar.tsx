"use client";

import { useState, useRef, useEffect } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
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
}

export function TablaToolbar({ filtros, onChange, total }: TablaToolbarProps) {
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const cantidadFiltros = filtros.roles.length + filtros.estados.length;

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, []);

  function setBusqueda(busqueda: string) {
    onChange({ ...filtros, busqueda });
  }

  function toggleRol(rol: "admin" | "empleado") {
    const roles = filtros.roles.includes(rol)
      ? filtros.roles.filter((r) => r !== rol)
      : [...filtros.roles, rol];
    onChange({ ...filtros, roles });
  }

  function toggleEstado(estado: "activo" | "inactivo") {
    const estados = filtros.estados.includes(estado)
      ? filtros.estados.filter((e) => e !== estado)
      : [...filtros.estados, estado];
    onChange({ ...filtros, estados });
  }

  function limpiarTodo() {
    onChange({ ...filtros, roles: [], estados: [] });
    setDropdownAbierto(false);
  }

  function removerChip(tipo: "rol" | "estado", valor: string) {
    if (tipo === "rol") {
      onChange({ ...filtros, roles: filtros.roles.filter((r) => r !== valor) });
    } else {
      onChange({ ...filtros, estados: filtros.estados.filter((e) => e !== valor) });
    }
  }

  const chips: { tipo: "rol" | "estado"; valor: string; variante: string }[] = [
    ...filtros.roles.map((r) => ({ tipo: "rol" as const, valor: r, variante: r })),
    ...filtros.estados.map((e) => ({ tipo: "estado" as const, valor: e, variante: e })),
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        {/* Search */}
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Buscar por nombre o correo"
            value={filtros.busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {filtros.busqueda && (
            <button className={styles.searchClear} onClick={() => setBusqueda("")}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className={styles.divider} />

        {/* Botón filtros */}
        <div className={styles.dropdownWrap} ref={dropdownRef}>
          <button
            className={`${styles.filterBtn} ${cantidadFiltros > 0 ? styles.filterBtnActive : ""}`}
            onClick={() => setDropdownAbierto((v) => !v)}
          >
            <SlidersHorizontal size={14} />
            Filtros
            {cantidadFiltros > 0 && (
              <span className={styles.badge}>{cantidadFiltros}</span>
            )}
          </button>

          {dropdownAbierto && (
            <div className={styles.dropdown}>
              <p className={styles.ddLabel}>Rol</p>
              {(["admin", "empleado"] as const).map((rol) => (
                <button
                  key={rol}
                  className={`${styles.ddItem} ${filtros.roles.includes(rol) ? styles.ddItemSelected : ""}`}
                  onClick={() => toggleRol(rol)}
                >
                  <span className={`${styles.ddCheck} ${filtros.roles.includes(rol) ? styles.ddCheckOn : ""}`} />
                  <span style={{ textTransform: "capitalize" }}>{rol}</span>
                </button>
              ))}

              <div className={styles.separator} />

              <p className={styles.ddLabel}>Estado</p>
              {(["activo", "inactivo"] as const).map((estado) => (
                <button
                  key={estado}
                  className={`${styles.ddItem} ${filtros.estados.includes(estado) ? styles.ddItemSelected : ""}`}
                  onClick={() => toggleEstado(estado)}
                >
                  <span className={`${styles.ddCheck} ${filtros.estados.includes(estado) ? styles.ddCheckOn : ""}`} />
                  <span style={{ textTransform: "capitalize" }}>{estado}</span>
                </button>
              ))}

              {cantidadFiltros > 0 && (
                <>
                  <div className={styles.separator} />
                  <button className={styles.ddLimpiar} onClick={limpiarTodo}>
                    Limpiar todo
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}