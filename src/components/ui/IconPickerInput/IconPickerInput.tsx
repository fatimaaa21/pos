"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, ImageIcon } from "lucide-react";
import { ICONOS_CATEGORIAS } from "@/components/icons/categorias-iconos";
import { parseImgCategory } from "@/lib/utils/img-category";
import { IconoCategoria } from "@/components/ui/IconoCategoria";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";
import styles from "./IconPickerInput.module.css";

type Tab = "iconos" | "imagen";

interface Props {
  value: string;
  onChange: (value: string) => void;
  bucket?: string;
  storagePath?: string;
}

export function IconPickerInput({
  value,
  onChange,
  bucket = "category-images",
  storagePath,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [tab, setTab] = useState<Tab>("iconos");
  const [busqueda, setBusqueda] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const parsed = parseImgCategory(value);
  const tieneValor = parsed.tipo !== "vacio";

  const etiquetaActual =
    parsed.tipo === "icono"
      ? (ICONOS_CATEGORIAS.find((i) => i.key === parsed.key)?.label ?? "Ícono")
      : parsed.tipo === "imagen"
      ? "Imagen subida"
      : "Seleccionar ícono o imagen";

  // Cerrar al hacer clic afuera
  useEffect(() => {
    if (!abierto) return;
    function onOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [abierto]);

  const iconosFiltrados = ICONOS_CATEGORIAS.filter(
    (i) => !busqueda || i.label.toLowerCase().includes(busqueda.toLowerCase())
  );

  function seleccionarIcono(key: string) {
    onChange(`icon:${key}`);
    setAbierto(false);
    setBusqueda("");
  }

  function limpiar(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {/* Trigger */}
        <div className={styles.triggerRow}>
            <button
                type="button"
                className={`${styles.trigger} ${abierto ? styles.triggerActivo : ""}`}
                onClick={() => setAbierto((v) => !v)}
            >
                <div className={styles.preview}>
                {tieneValor ? (
                    <span className={styles.previewIcono}>
                    <IconoCategoria value={value} size={20} color="var(--color-primary)" />
                    </span>
                ) : (
                    <ImageIcon size={15} strokeWidth={1.5} />
                )}
                </div>
                <span className={`${styles.label} ${!tieneValor ? styles.placeholder : ""}`}>
                {etiquetaActual}
                </span>
                {tieneValor && (
                    <button type="button" className={styles.btnLimpiar} onClick={limpiar} title="Quitar">
                    <X size={13} />
                    </button>
                )}
            </button>
        </div>

      {/* Panel */}
      {abierto && (
        <div className={styles.panel}>
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${tab === "iconos" ? styles.tabActiva : ""}`}
              onClick={() => setTab("iconos")}
            >
              Íconos
            </button>
            <button
              type="button"
              className={`${styles.tab} ${tab === "imagen" ? styles.tabActiva : ""}`}
              onClick={() => setTab("imagen")}
            >
              Imagen
            </button>
          </div>

          {/* ── Tab Íconos ── */}
          {tab === "iconos" && (
            <>
              <div className={styles.searchRow}>
                <Search size={12} className={styles.searchIcon} />
                <input
                  autoFocus
                  type="text"
                  className={styles.searchInput}
                  placeholder="Filtrar..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                {busqueda && (
                  <button type="button" className={styles.btnLimpiar} onClick={() => setBusqueda("")}>
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className={styles.grid}>
                {iconosFiltrados.length === 0 ? (
                  <p className={styles.vacio}>Sin resultados</p>
                ) : (
                  iconosFiltrados.map((item) => {
                    const activo = parsed.tipo === "icono" && parsed.key === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        title={item.label}
                        className={`${styles.iconBtn} ${activo ? styles.iconBtnActivo : ""}`}
                        onClick={() => seleccionarIcono(item.key)}
                      >
                        <IconoCategoria
                          value={`icon:${item.key}`}
                          size={20}
                          color={activo ? "var(--color-primary)" : "var(--gray)"}
                        />
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* ── Tab Imagen ── */}
          {tab === "imagen" && (
            <div className={styles.imagenTab}>
              <ImageUploadInput
                value={parsed.tipo === "imagen" ? parsed.url : ""}
                onChange={(url) => {
                  onChange(url);
                  if (url) setAbierto(false);
                }}
                placeholder="Subir imagen"
                bucket={bucket}
                storagePath={storagePath ?? `categorias/new_${Date.now()}`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}